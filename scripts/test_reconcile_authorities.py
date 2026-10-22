"""Synthetic institutional fixtures; no real identities or network access."""
from copy import deepcopy
from datetime import date
import tempfile
from pathlib import Path
from openpyxl import Workbook
import unittest
from reconcile_authorities import reconcile, compatible, code_key, role_kind, temporal, apply_rename_proposals, coverage, read_source
from test_organization_import import synthetic_key

DAY = date(2026, 10, 22)
ROOT = {'id':'root','parent_id':None,'name':'Ministerio de Prueba','unit_type':'Organismo','code':'01'}
UNIT = {'id':'go','parent_id':'root','name':'GO Innovación','unit_type':'Gerencia Operativa','code':'08010000'}
def row(**changes):
    return {'key':synthetic_key('2099990001'), 'name':'Persona Sintética', 'role':'GERENTE OPERATIVO',
            'code':'8010000','unit':'Gerencia Operativa de Innovación','ministry':'Ministerio de Prueba',
            'path':r'\Ministerio de Prueba\GO Innovación','source':'Dotación institucional','source_period':'2026-10',
            'official':False,'since':None,'until':None, **changes}
def run(rows, unit=None, assignments=None):
    return reconcile({'units':[ROOT,unit or UNIT], 'assignments':assignments or []}, rows, DAY)[1]

class AuthorityTests(unittest.TestCase):
    def test_code_equivalence_without_padding_or_reparenting(self):
        self.assertEqual(code_key('08010000'),code_key('8010000.0'))
        self.assertNotEqual(code_key('AB01'),code_key('AB1'))
        self.assertIsNone(code_key('0000'))
        result = run([row()]); self.assertEqual(result['status'],'automatic')
        self.assertEqual(result['winner']['method'],'code_numeric_equivalent')
        self.assertEqual(UNIT['code'],'08010000')

    def test_all_levels_and_special_administrative_ranks(self):
        examples = [('Jefe de Gobierno','Organismo','Jefe de Gobierno'),('Vicejefatura de Gobierno','Organismo','Vicejefe de Gobierno'),
          ('Jefatura de Gabinete de Ministros','Organismo','JEFE DE GABINETE DE MINISTROS'),('Ministerio de Prueba','Organismo','Ministro'),
          ('SEC Prueba','Secretaría','SECRETARIO'),('SS Prueba','Subsecretaría','Subsecretario'),('DG Prueba','Dirección General','Director General'),
          ('GG Prueba','Gerencia General','GERENTE GENERAL SINDICATURA'),('GO Prueba','Gerencia Operativa','Gerente Operativo Concursado'),
          ('SGO Prueba','Subgerencia Operativa','SUBGERENTE OPERATIVO'),('Sindicatura General de la Ciudad de Buenos Aires','Organismo','Ministro'),
          ('Sindicatura General Adjunta','Unidad organizacional','Subsecretario'),('Procuración General de la Ciudad de Buenos Aires','Organismo','Ministro'),
          ('PG Adjunta Asuntos Judiciales','Unidad organizacional','Subsecretario'),('Unidad de Prueba','Unidad organizacional','Titular de Unidad'),
          ('Consejo de Prueba','Unidad organizacional','PRESIDENTE CPC')]
        for name,typ,role in examples:
            with self.subTest(name=name): self.assertIsNotNone(compatible({'name':name,'unit_type':typ},row(role=role)))
        self.assertEqual(compatible({'name':examples[10][0],'unit_type':'Organismo'},row(role='Ministro')),'Síndico/a General')
        for role in ('Secretaria','Secretario escolar','PROCURADOR','Director de escuela','Administrativo'):
            self.assertIsNone(role_kind(role))
        self.assertIsNone(compatible({'name':'Obligaciones a Cargo del Tesoro','unit_type':'Organismo'},row(role='Ministro')))

    def test_active_identity_is_unique_duplicate_rows_are_not_new_people(self):
        self.assertEqual(run([row(),row()])['status'],'automatic')
        self.assertEqual(run([row(),row(key=synthetic_key('2099990002'),name='Otra Persona')])['status'],'pending')
        self.assertEqual(run([row(),row(key=None,name='Identidad sin validar')])['status'],'pending')
        # An office with the same name in another ministry does not invalidate an exact code.
        self.assertEqual(run([row(),row(code='999',ministry='Otro Ministerio',key=synthetic_key('2099990002'))])['status'],'automatic')

    def test_code_name_root_path_and_position_are_required(self):
        for change in ({'code':'999'}, {'unit':'Otra gerencia'}, {'ministry':'Otro Ministerio'}, {'path':r'\Otra estructura\GO Innovación'}, {'source_period':'2026-09'}):
            with self.subTest(change=change): self.assertNotEqual(run([row(**change)])['status'],'automatic')
        self.assertEqual(run([row(role='Director General')])['status'],'unidentified')
        self.assertEqual(run([row(name='Mar?A Ejemplo')])['status'],'pending')
        no_code = {**UNIT,'code':None}
        self.assertEqual(run([row()],no_code)['status'],'pending')

    def test_validity_and_history_no_seniority_guesses(self):
        official = row(official=True,active='activo',since='2025-01-01',until='4000-01-01',source_date='2026-10-15')
        self.assertEqual(temporal(official,DAY)[0],True)
        for change in ({'since':'2026-11-01'}, {'until':'2026-10-01'}, {'active':'baja'}, {'invalid_date':True}, {'source_date':'2026-11-01'}):
            self.assertEqual(temporal({**official,**change},DAY)[0],False)
        self.assertIsNone(temporal({**official,'until':None},DAY)[0])
        self.assertIsNone(temporal({**official,'source_period':'2026-09'},DAY)[0])
        self.assertEqual(run([row(),{**official,'key':synthetic_key('2099990002'),'until':'2026-10-01'}])['status'],'automatic')
        self.assertEqual(run([row(),{**official,'until':'2026-10-01'}])['status'],'pending','monthly presence never silently overrides a dated termination')
        self.assertEqual(run([row(),{**official,'until':'2026-10-01'},official])['status'],'automatic','a newer active designation resolves the same-person history')

    def test_manual_decisions_preserved_and_discrepancy_retained(self):
        old = {'unit_id':'go','responsibility_confirmed':True,'link_key':synthetic_key('2099990002'),'verification_basis':'Confirmado por norma', 'assignment_origin':'manual'}
        result = run([row()],assignments=[old])
        self.assertEqual(result['status'],'manual'); self.assertIn('discrepancia',result['reason'])
        unit = {**UNIT,'authority_reviewed':True,'authority_status':'vacant'}
        self.assertEqual(run([row()],unit)['status'],'vacant')
        old['assignment_origin']='automatic'
        self.assertEqual(run([row()],assignments=[old])['status'],'automatic')

    def test_same_identity_can_hold_multiple_distinct_functions(self):
        second = {**UNIT,'id':'go2','code':'99','name':'GO Otra'}
        rows = [row(),row(code='99',unit='GO Otra',path=r'\Ministerio de Prueba\GO Otra')]
        result = reconcile({'units':[ROOT,UNIT,second]},rows,DAY)
        self.assertEqual(sum(r['status']=='automatic' for r in result),2)

    def test_rename_is_reviewable_and_keeps_stable_id(self):
        snapshot = {'units':[ROOT,UNIT]}; results = reconcile(snapshot,[row()],DAY)
        original = deepcopy(snapshot)
        proposal = {'unit_id':'go','code':'08010000','previous_name':'GO Innovación','new_name':'GO Nueva Denominación',
                    'organism':'Ministerio de Prueba','observed_at':'2026-10-15','evidence':'PDF institucional página de prueba'}
        apply_rename_proposals(results,snapshot,[proposal],DAY)
        self.assertEqual(snapshot,original); self.assertEqual(results[1]['rename']['name'],proposal['new_name'])
        with self.assertRaises(ValueError): apply_rename_proposals(results,snapshot,[{**proposal,'code':'wrong'}],DAY)
        self.assertEqual(coverage(results)['total']['automatic'],1)
        renamed = {**UNIT,'name':'GO Nueva Denominación','name_history':[{'name':'GO Innovación'}]}
        self.assertEqual(run([row()],renamed)['status'],'automatic','only confirmed historical names are aliases')

    def test_actual_source_schema_whitelist_and_invalid_dates(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'roster.xlsx'; book=Workbook(); sheet=book.active
            sheet.append(['AYN','CUIL','LIT_PUESTO','COD_REP','DESC_REP','MINISTERIO','PATH_NOMBRES','MAIL_PERSONAL','INGRESO','ROL'])
            sheet.append(['APELLIDO, NOMBRE',synthetic_key('2099990001'),'GERENTE OPERATIVO','08010000','GO Innovación','Ministerio de Prueba',r'\Ministerio de Prueba\GO Innovación','never-export@example.invalid','1980-01-01',9])
            book.save(path); rows,_,_=read_source(path,'2026-10'); book.close()
            self.assertEqual(len(rows),1); self.assertEqual(rows[0]['name'],'Nombre Apellido')
            self.assertEqual(rows[0]['since'],None,'seniority is never a designation date')
            self.assertNotIn('never-export',str(rows)); self.assertNotIn('1980',str(rows))
            sheet.delete_cols(7); book.save(path)
            with self.assertRaises(ValueError): read_source(path,'2026-10')

    def test_full_ancestry_not_any_matching_ancestor(self):
        intermediate={'id':'dg','parent_id':'root','name':'DG Prueba','unit_type':'Dirección General','code':'03'}
        nested={**UNIT,'parent_id':'dg'}
        self.assertEqual(reconcile({'units':[ROOT,intermediate,nested]},[row(path=r'\Ministerio de Prueba\DG Prueba\Otra Rama\GO Innovación')],DAY)[2]['status'],'pending')

if __name__ == '__main__': unittest.main()
