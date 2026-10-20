import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from seed_mock_access_applicant import fixture, transaction, IDENTIFIER


class MockApplicantTests(unittest.TestCase):
    def test_fixture_is_a_labeled_manager_with_verified_mailbox_contact(self):
        data = fixture(' Applicant@Example.Test ')
        self.assertEqual(data['email'], 'applicant@example.test')
        self.assertEqual(data['contacts'][0]['value'], data['email'])
        self.assertEqual(data['assignments'][0]['identifier'], IDENTIFIER)
        self.assertTrue(data['assignments'][0]['role'].startswith('Gerente'))
        self.assertIn('MOCK', data['assignments'][0]['ministry'])

    def test_only_snapshot_is_written_and_registration_stays_uncreated(self):
        sql = transaction(fixture('applicant@example.test'))
        self.assertIn('insert into rcg_private.gerencial_snapshot_people', sql)
        for table in ['auth.users', 'red_conexion_gerencial.people', 'red_conexion_gerencial.member_accounts', 'rcg_private.admin_requests']:
            self.assertNotIn('insert into '+table, sql)
            self.assertNotIn('update '+table, sql)
            self.assertNotIn('delete from '+table, sql)
        self.assertIn('no_auth_account', sql)
        self.assertIn('no_previous_request', sql)

    def test_quoted_email_cannot_close_a_procedural_sql_block(self):
        sql = transaction(fixture("test'$$@example.test"))
        self.assertIn("test''$$@example.test", sql)
        self.assertNotIn('do $$', sql)
        self.assertIn('do $fixture_', sql)

    def test_invalid_mailbox_is_rejected(self):
        for email in ['', 'not-an-email', 'a b@example.test', 'user@example']:
            with self.assertRaises(ValueError): fixture(email)


if __name__ == '__main__':
    unittest.main()
