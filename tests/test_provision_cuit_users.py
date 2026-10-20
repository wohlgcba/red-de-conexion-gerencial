import contextlib
import io
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import bcrypt
import provision_cuit_users as provision


class ProvisioningTests(unittest.TestCase):
    def test_existing_auth_accounts_are_never_updated(self):
        sent = []
        def request(key, method, url, body=None):
            sent.append((method, body))
            return {'id': 'synthetic-user'}
        with patch.object(provision, 'load_people', return_value=([(1, 'existing@example.test', '20999900020'), (2, 'new@example.test', '20999900020')], [])), \
             patch.object(provision.shutil, 'which', return_value='npx'), \
             patch.object(provision, 'get_service_key', return_value='synthetic'), \
             patch.object(provision, 'existing_emails', return_value={'existing@example.test'}), \
             patch.object(provision, 'api_request', side_effect=request), \
             patch.object(provision, 'link_new_accounts') as link, \
             patch.object(sys, 'argv', ['provision', '--execute']), contextlib.redirect_stdout(io.StringIO()):
            provision.main()
        self.assertEqual(len(sent), 1)
        method, body = sent[0]
        self.assertEqual(method, 'POST')
        self.assertEqual(body['email'], 'new@example.test')
        self.assertNotIn('password', body)
        self.assertTrue(bcrypt.checkpw(b'20999900020', body['password_hash'].encode()))
        self.assertEqual(body['app_metadata'], {'rcg_initial_cuit': True})
        self.assertTrue(body['email_confirm'])
        link.assert_called_once()

    def test_identifier_validation(self):
        self.assertEqual(provision.valid_cuit('20-99990002-0'), '20999900020')
        for value in [None, '', '00000000000', '123', '20999900021']:
            self.assertIsNone(provision.valid_cuit(value))

    def test_dry_run_never_creates_or_links_accounts(self):
        with patch.object(provision, 'load_people', return_value=([(1, 'new@example.test', '20999900020')], [])), \
             patch.object(provision.shutil, 'which', return_value='npx'), \
             patch.object(provision, 'get_service_key', return_value='synthetic'), \
             patch.object(provision, 'existing_emails', return_value=set()), \
             patch.object(provision, 'api_request') as request, \
             patch.object(provision, 'link_new_accounts') as link, \
             patch.object(sys, 'argv', ['provision']), contextlib.redirect_stdout(io.StringIO()):
            provision.main()
        request.assert_not_called()
        link.assert_not_called()


if __name__ == '__main__':
    unittest.main()
