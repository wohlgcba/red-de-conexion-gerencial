"""Offline regression checks. Run: python -m unittest discover -s scripts -p test_organization_import.py"""
import tempfile
import unittest
from pathlib import Path
from openpyxl import Workbook
from build_organization_sample import extract, valid_key, unit_type

def synthetic_key(base):
    digit = 11 - sum(int(a)*b for a,b in zip(base, [5,4,3,2,7,6,5,4,3,2])) % 11
    return base + str(0 if digit == 11 else 9 if digit == 10 else digit)

class OrganizationImportTests(unittest.TestCase):
    def test_institutional_abbreviations_do_not_lose_intermediate_levels(self):
        self.assertEqual(unit_type('SS Gobierno', False), 'Subsecretaría')
        self.assertEqual(unit_type('SECR Legal y Técnica', False), 'Secretaría')
        self.assertEqual(unit_type('SDG Gestión', False), 'Subdirección General')
        self.assertEqual(unit_type('DIR Judicial', False), 'Dirección')
        self.assertEqual(unit_type('Departamento de Prueba', False), 'Departamento')

    def test_keys_are_normalized_and_validated(self):
        key = synthetic_key('2012345678')
        self.assertEqual(valid_key(f'{key[:2]}-{key[2:10]}-{key[10]}'), key)
        self.assertEqual(valid_key(int(key)), key)
        self.assertIsNone(valid_key(key + '0'))
        self.assertIsNone(valid_key(key[:-1] + str((int(key[-1]) + 1) % 10)))

    def test_context_deduplication_reconciliation_and_privacy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            directory_book = Workbook()
            directory_book.active.title = 'Respuestas de formulario 1'
            directory_book.active.append(['Nombre', 'Cuit'])
            key = synthetic_key('2012345678')
            directory_book.active.append(['Do not export this person', key])
            directory_book.save(root / 'directory.xlsx')
            book = Workbook()
            sheet = book.active
            sheet.append(['MINISTERIO','CUIL','AYN','LIT_PUESTO','SIGLA','COD_REP','DESC_REP','PATH_NOMBRES'])
            path = '\\Organismo A\\Dirección General de Prueba\\Gerencia Operativa de Gestión'
            sheet.append(['Organismo A', key, 'PRIVATE PERSON', 'GERENTE OPERATIVO', 'SIG', '001', 'Gestión', path])
            sheet.append(['Organismo A', key, 'PRIVATE PERSON', 'GERENTE OPERATIVO', 'SIG', '002', 'Gestión', path])
            sheet.append(['Organismo B', key, 'PRIVATE PERSON', 'ADMINISTRATIVO', 'SIG', '003', 'Gestión', '\\Organismo B\\Gerencia Operativa de Gestión'])
            book.save(root / 'dotacion.xlsx')
            data = extract(root / 'dotacion.xlsx', root / 'directory.xlsx')
            self.assertEqual(len(data['units']), 5)
            self.assertEqual(data['sample']['roots'], 2)
            self.assertEqual(data['sample']['directoryMatchesOffline'], 1)
            self.assertEqual(data['sample']['candidateUnits'], 1)
            self.assertEqual(data['sample']['codeConflicts'], 1)
            same_names = [u for u in data['units'] if u['name'] == 'Gerencia Operativa de Gestión']
            self.assertEqual(len({u['id'] for u in same_names}), 2)
            self.assertNotIn(key, str(data))
            self.assertNotIn('PRIVATE PERSON', str(data))
            for unit in data['units']:
                self.assertEqual(set(unit), {'id','parentId','name','type','code','directorateId'})

if __name__ == '__main__': unittest.main()
