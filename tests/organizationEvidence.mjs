// Synthetic fixtures for the existing Organigrama model. Never imports Dotación.
export async function addOrganizationEvidence(db, key, role, name = 'Responsable de prueba') {
  const unit = (await db.query("insert into red_conexion_gerencial.organization_units(id,name,unit_type,source_key) values(gen_random_uuid(),'Unidad de prueba','Gerencia Operativa',gen_random_uuid()::text) returning id")).rows[0].id
  const person = (await db.query("insert into rcg_private.organization_people(id,link_key,institutional_name,verified_at,verification_basis) values(gen_random_uuid(),$1,$2,now(),'Fixture de prueba') on conflict(link_key) do update set institutional_name=excluded.institutional_name returning id", [key, name])).rows[0].id
  await db.query("insert into rcg_private.organization_assignments(id,unit_id,responsible_id,position_title,responsibility_confirmed,verification_basis) values(gen_random_uuid(),$1,$2,$3,true,'Fixture de prueba')", [unit, person, role])
}
