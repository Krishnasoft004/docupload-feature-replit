import requests
import sys
import json
import io
from datetime import datetime
import time

class FinQueryAPITester:
    def __init__(self, base_url="https://pyai-assistant.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = f"test-session-{int(time.time())}"
        self.uploaded_doc_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {}
        
        if data and not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=60)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_root_endpoint(self):
        """Test root endpoint"""
        return self.run_test("Root Endpoint", "GET", "", 200)

    def test_get_documents_empty(self):
        """Test getting documents when none uploaded"""
        return self.run_test("Get Documents (Empty)", "GET", "documents", 200)

    def test_upload_document_docx(self):
        """Test uploading a DOCX document"""
        # Create a simple DOCX file content using python-docx format
        # This is a minimal DOCX structure that should be readable
        import zipfile
        import xml.etree.ElementTree as ET
        
        # Create DOCX content
        docx_content = io.BytesIO()
        
        with zipfile.ZipFile(docx_content, 'w', zipfile.ZIP_DEFLATED) as docx:
            # Add [Content_Types].xml
            content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''
            docx.writestr('[Content_Types].xml', content_types)
            
            # Add _rels/.rels
            rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''
            docx.writestr('_rels/.rels', rels)
            
            # Add word/document.xml with financial content
            document = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Financial Report Q1 2024</w:t></w:r></w:p>
<w:p><w:r><w:t>Revenue: $1,250,000</w:t></w:r></w:p>
<w:p><w:r><w:t>Expenses: $850,000</w:t></w:r></w:p>
<w:p><w:r><w:t>Net Income: $400,000</w:t></w:r></w:p>
<w:p><w:r><w:t>Growth Rate: 15% compared to Q1 2023</w:t></w:r></w:p>
<w:p><w:r><w:t>Key Metrics:</w:t></w:r></w:p>
<w:p><w:r><w:t>- Customer Acquisition Cost: $125</w:t></w:r></w:p>
<w:p><w:r><w:t>- Monthly Recurring Revenue: $415,000</w:t></w:r></w:p>
<w:p><w:r><w:t>- Gross Margin: 68%</w:t></w:r></w:p>
</w:body>
</w:document>'''
            docx.writestr('word/document.xml', document)
        
        docx_bytes = docx_content.getvalue()
        files = {'file': ('financial_report_q1_2024.docx', docx_bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
        success, response = self.run_test("Upload DOCX Document", "POST", "upload-document", 200, files=files)
        
        if success and 'id' in response:
            self.uploaded_doc_id = response['id']
            print(f"   Document ID: {self.uploaded_doc_id}")
            return True
        return False

    def test_upload_unsupported_file(self):
        """Test uploading unsupported file type"""
        files = {'file': ('test.txt', b'This is a text file', 'text/plain')}
        success, response = self.run_test("Upload Unsupported File", "POST", "upload-document", 400, files=files)
        return success  # Success means we got the expected 400 error

    def test_upload_large_file(self):
        """Test uploading file larger than 20MB"""
        # Create a file larger than 20MB
        large_content = b'x' * (21 * 1024 * 1024)  # 21MB
        files = {'file': ('large_file.pdf', large_content, 'application/pdf')}
        success, response = self.run_test("Upload Large File (>20MB)", "POST", "upload-document", 400, files=files)
        return success  # Success means we got the expected 400 error

    def test_chat_without_documents(self):
        """Test chat when no documents are uploaded"""
        chat_data = {
            "session_id": self.session_id,
            "message": "What is the revenue for Q1?"
        }
        return self.run_test("Chat Without Documents", "POST", "chat", 200, data=chat_data)

    def test_chat_with_documents(self):
        """Test chat after uploading documents"""
        if not self.uploaded_doc_id:
            print("⚠️  Skipping chat test - no document uploaded")
            return False
            
        chat_data = {
            "session_id": self.session_id,
            "message": "What information is available in the financial report?"
        }
        success, response = self.run_test("Chat With Documents", "POST", "chat", 200, data=chat_data)
        
        if success:
            # Check if response contains expected fields
            if 'response' in response and 'sources' in response:
                print("   ✅ Response contains required fields")
                return True
            else:
                print("   ❌ Response missing required fields")
                return False
        return False

    def test_get_documents_after_upload(self):
        """Test getting documents after upload"""
        success, response = self.run_test("Get Documents (After Upload)", "GET", "documents", 200)
        
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   ✅ Found {len(response)} documents")
            return True
        elif success and isinstance(response, list) and len(response) == 0:
            print("   ⚠️  No documents found after upload")
            return False
        return False

    def test_chat_history(self):
        """Test getting chat history"""
        return self.run_test("Get Chat History", "GET", f"chat-history/{self.session_id}", 200)

def main():
    print("🚀 Starting FinQuery AI Backend API Tests")
    print("=" * 50)
    
    tester = FinQueryAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Root Endpoint", tester.test_root_endpoint),
        ("Get Documents (Empty)", tester.test_get_documents_empty),
        ("Upload DOCX Document", tester.test_upload_document_docx),
        ("Upload Unsupported File", tester.test_upload_unsupported_file),
        ("Upload Large File", tester.test_upload_large_file),
        ("Get Documents (After Upload)", tester.test_get_documents_after_upload),
        ("Chat Without Documents", tester.test_chat_without_documents),
        ("Chat With Documents", tester.test_chat_with_documents),
        ("Get Chat History", tester.test_chat_history),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {len(failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())