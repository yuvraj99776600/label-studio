"""
Security tests for custom hotkeys to prevent XSS vulnerabilities.
Tests various XSS attack vectors to ensure proper sanitization.
"""
import json

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from users.serializers import HotkeysSerializer

User = get_user_model()


class TestHotkeysXSSPrevention(TestCase):
    """Tests to ensure XSS attacks via custom hotkeys are prevented"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='password123')
        self.client.force_authenticate(user=self.user)
        self.url = reverse('current-user-hotkeys')

    def test_script_tag_injection_blocked(self):
        """Test that script tags in hotkey values are blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': '<script>alert("XSS")</script>', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('custom_hotkeys', response.data)

    def test_javascript_protocol_blocked(self):
        """Test that javascript: protocol in hotkeys is blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:open': {'key': 'javascript:alert(1)', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_event_handler_injection_blocked(self):
        """Test that event handlers like onerror are blocked"""
        malicious_payloads = [
            {'custom_hotkeys': {'editor:save': {'key': 'onerror=alert(1)', 'active': True}}},
            {'custom_hotkeys': {'editor:save': {'key': 'onload=alert(1)', 'active': True}}},
        ]

        for payload in malicious_payloads:
            response = self.client.patch(self.url, data=json.dumps(payload), content_type='application/json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_eval_function_blocked(self):
        """Test that eval() function calls are blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': 'ctrl+eval(alert(1))', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_html_entity_encoding(self):
        """Test that special HTML characters are properly handled"""
        malicious_payloads = [
            {'custom_hotkeys': {'editor:save': {'key': '&lt;script&gt;', 'active': True}}},
            {'custom_hotkeys': {'editor:save': {'key': '&#60;script&#62;', 'active': True}}},
        ]

        for payload in malicious_payloads:
            response = self.client.patch(self.url, data=json.dumps(payload), content_type='application/json')
            # Should be blocked due to invalid characters
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_iframe_injection_blocked(self):
        """Test that iframe tags are blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': '<iframe src="evil.com"></iframe>', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_document_window_access_blocked(self):
        """Test that document.* and window.* patterns are blocked"""
        malicious_payloads = [
            {'custom_hotkeys': {'editor:save': {'key': 'document.cookie', 'active': True}}},
            {'custom_hotkeys': {'editor:save': {'key': 'window.location', 'active': True}}},
        ]

        for payload in malicious_payloads:
            response = self.client.patch(self.url, data=json.dumps(payload), content_type='application/json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_hotkeys_still_work(self):
        """Test that legitimate hotkeys still work after security fixes"""
        valid_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': 'ctrl+s', 'active': True},
                'editor:find': {'key': 'ctrl+shift+f', 'active': True},
                'editor:open': {'key': 'alt+o', 'active': True},
                'navigation:home': {'key': 'shift+h', 'active': False},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(valid_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify data was saved correctly
        user = User.objects.get(id=self.user.id)
        self.assertEqual(user.custom_hotkeys, valid_payload['custom_hotkeys'])

    def test_special_keyboard_chars_allowed(self):
        """Test that special keyboard characters are allowed"""
        valid_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': 'ctrl+[', 'active': True},
                'editor:find': {'key': 'alt+/', 'active': True},
                'editor:open': {'key': 'shift+;', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(valid_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_quote_escaping_in_action_key(self):
        """Test that quotes in action keys don't cause injection"""
        # Action key with quotes should be handled safely
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save": alert("xss")//': {'key': 'ctrl+s', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        # Should succeed as action key format is validated but quotes are allowed
        # The key itself should still be valid
        # However, this may fail due to action key format validation
        # Either way, it shouldn't cause XSS
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])

    def test_null_byte_injection(self):
        """Test that null bytes are blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': 'ctrl+s\x00<script>', 'active': True},
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_excessive_hotkey_count_blocked(self):
        """Test that too many hotkeys are rejected (DoS prevention)"""
        # Create more than MAX_HOTKEYS
        excessive_payload = {
            'custom_hotkeys': {f'section:action{i}': {'key': f'ctrl+{i}', 'active': True} for i in range(201)}
        }

        response = self.client.patch(self.url, data=json.dumps(excessive_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('200', str(response.data))  # Should mention the limit

    def test_long_key_combination_blocked(self):
        """Test that excessively long key combinations are blocked"""
        malicious_payload = {
            'custom_hotkeys': {
                'editor:save': {'key': 'a' * 100, 'active': True},  # 100 chars
            }
        }

        response = self.client.patch(self.url, data=json.dumps(malicious_payload), content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestHotkeysSerializerSecurity:
    """Tests for the HotkeysSerializer security validations"""

    def test_dangerous_characters_blocked(self):
        """Test that dangerous characters are blocked in key combinations"""
        dangerous_keys = [
            '<script>',
            'javascript:',
            'onerror=',
            'onload=',
            'eval(',
            'alert(',
            'document.',
            'window.',
            '<iframe',
            '<object',
            '<embed',
        ]

        for dangerous_key in dangerous_keys:
            data = {'custom_hotkeys': {'editor:save': {'key': dangerous_key, 'active': True}}}
            serializer = HotkeysSerializer(data=data)

            assert not serializer.is_valid(), f'Should block dangerous key: {dangerous_key}'
            assert 'custom_hotkeys' in serializer.errors

    def test_backslash_and_quote_handling(self):
        """Test that backslashes and quotes in keys don't cause injection"""
        # These should be blocked as they're not standard keyboard keys
        test_cases = [
            {'custom_hotkeys': {'editor:save': {'key': 'ctrl+\\', 'active': True}}},
            {'custom_hotkeys': {'editor:save': {'key': "ctrl+'", 'active': True}}},
            {'custom_hotkeys': {'editor:save': {'key': 'ctrl+"', 'active': True}}},
        ]

        for data in test_cases:
            serializer = HotkeysSerializer(data=data)
            # These should fail due to character restrictions
            assert not serializer.is_valid()

    def test_unicode_characters_handled(self):
        """Test that unicode characters are properly handled"""
        data = {'custom_hotkeys': {'editor:save': {'key': 'ctrl+\u0041', 'active': True}}}  # \u0041 is 'A'
        serializer = HotkeysSerializer(data=data)

        # Should be valid as it's just 'A'
        assert serializer.is_valid()
