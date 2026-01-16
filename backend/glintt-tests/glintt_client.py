"""
Shared Glintt API client for test harness.
Handles authentication and common API operations.

This is a developer test tool - NOT production code.
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class GlinttTestClient:
    """
    Glintt API client for testing schedule and reschedule operations.
    
    Uses environment variables for configuration to avoid hardcoding secrets.
    """
    
    def __init__(self):
        # Load configuration from environment
        self.base_url = os.getenv('GLINTT_BASE_URL')
        self.client_id = os.getenv('GLINTT_CLIENT_ID')
        self.client_secret = os.getenv('GLINTT_CLIENT_SECRET')
        self.tenant_id = os.getenv('GLINTT_TENANT_ID')
        self.facility_id = os.getenv('GLINTT_FACILITY_ID')
        self.username = os.getenv('GLINTT_USERNAME')
        
        # Validate required config
        self._validate_config()
        
        # Test data configuration
        self.patient_id = os.getenv('GLINTT_TEST_PATIENT_ID', '150847')
        self.service_code = os.getenv('GLINTT_TEST_SERVICE_CODE', '36')
        self.medical_act_code = os.getenv('GLINTT_TEST_MEDICAL_ACT_CODE', '1')
        self.doctor_code = os.getenv('GLINTT_TEST_DOCTOR_CODE', '')
        self.financial_entity_code = os.getenv('GLINTT_TEST_FINANCIAL_ENTITY_CODE', '998')
        
        # Session and token
        self.token: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        })
    
    def _validate_config(self):
        """Validate required environment variables are set."""
        required = [
            ('GLINTT_BASE_URL', self.base_url),
            ('GLINTT_CLIENT_ID', self.client_id),
            ('GLINTT_CLIENT_SECRET', self.client_secret),
            ('GLINTT_TENANT_ID', self.tenant_id),
            ('GLINTT_FACILITY_ID', self.facility_id),
            ('GLINTT_USERNAME', self.username),
        ]
        
        missing = [name for name, value in required if not value]
        
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}\n"
                f"Please set them in .env file or environment."
            )
    
    def get_date_range(self) -> tuple[str, str]:
        """Get date range for slot search from env or default to next 7 days."""
        start = os.getenv('GLINTT_TEST_START_DATE')
        end = os.getenv('GLINTT_TEST_END_DATE')
        
        if start and end:
            return start, end
        
        # Default: next 7 days
        today = datetime.now()
        start_date = (today + timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = (today + timedelta(days=7)).strftime('%Y-%m-%d')
        
        return start_date, end_date
    
    def authenticate(self) -> bool:
        """
        Get authentication token from Glintt API.
        
        Returns:
            True if authentication succeeded, False otherwise.
        """
        print("Authenticating with Glintt API...")
        
        auth_url = f"{self.base_url}/Glintt.GPlatform.APIGateway.CoreWebAPI/token"
        
        auth_data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'password',
            'TenantID': self.tenant_id,
            'FacilityID': self.facility_id,
            'USERNAME': self.username,
        }
        
        try:
            response = self.session.post(
                auth_url,
                data=auth_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data.get('access_token')
                # Only print first 20 chars of token for security
                print(f"  Token obtained: {self.token[:20]}...")
                return True
            else:
                print(f"  FAIL: Authentication failed (HTTP {response.status_code})")
                return False
                
        except Exception as e:
            print(f"  FAIL: Authentication error - {str(e)}")
            return False
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get headers with authorization token."""
        if not self.token:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def search_slots(
        self,
        start_date: str,
        end_date: str,
        is_reschedule: bool = False,
        episode_id: Optional[str] = None,
        episode_type: str = "Consultas"
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Search for available slots using ExternalSearchSlots.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            is_reschedule: True if this is a reschedule operation
            episode_id: Episode ID (required for reschedule)
            episode_type: Episode type (default "Consultas")
        
        Returns:
            List of available slots, or None on error.
        """
        print(f"Searching slots: {start_date} to {end_date} (reschedule={is_reschedule})")
        
        # Build slot search request
        slot_request: Dict[str, Any] = {
            "StartDate": start_date,
            "EndDate": end_date,
            "MedicalActCode": self.medical_act_code,
            "ServiceCode": self.service_code,
            "RescheduleFlag": is_reschedule,
            "origin": "MALO_ADMIN",
        }
        
        if self.doctor_code:
            slot_request["HumanResourceCode"] = self.doctor_code
        
        if is_reschedule and episode_id:
            slot_request["episode"] = {
                "EpisodeType": episode_type,
                "EpisodeID": episode_id
            }
        
        request_body = {
            "LoadAppointments": False,
            "FullSearch": True,
            "NumberOfRegisters": 20,
            "Patient": {
                "PatientType": "MC",
                "PatientID": self.patient_id
            },
            "Period": [],
            "DaysOfWeek": [],
            "ExternalMedicalActSlotsList": [slot_request]
        }
        
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots"
        
        try:
            response = self.session.post(
                endpoint,
                headers=self._get_auth_headers(),
                json=request_body
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for errors
                if 'ErrorDetails' in data and data['ErrorDetails']:
                    error_details = data['ErrorDetails']
                    if error_details.get('Error'):
                        print(f"  FAIL: Glintt error - {error_details}")
                        return None
                
                slots = data.get('ExternalSearchSlot', [])
                
                # Filter to only available slots
                available_slots = [s for s in slots if not s.get('Occupation', False)]
                
                print(f"  Found {len(available_slots)} available slots")
                return available_slots
            else:
                print(f"  FAIL: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"  FAIL: Error - {str(e)}")
            return None
    
    def schedule_appointment(
        self,
        slot: Dict[str, Any],
        is_reschedule: bool = False,
        episode_id: Optional[str] = None,
        episode_type: str = "Consultas"
    ) -> Optional[Dict[str, Any]]:
        """
        Schedule or reschedule an appointment.
        
        Args:
            slot: Slot data from search_slots()
            is_reschedule: True if rescheduling existing appointment
            episode_id: Episode ID (required for reschedule)
            episode_type: Episode type
        
        Returns:
            Appointment response data, or None on error.
        """
        action = "Rescheduling" if is_reschedule else "Scheduling"
        print(f"{action} appointment at {slot['SlotDateTime']}")
        
        appointment_data: Dict[str, Any] = {
            "ServiceCode": self.service_code,
            "MedicalActCode": self.medical_act_code,
            "HumanResourceCode": slot['HumanResourceCode'],
            "FinancialEntity": {
                "EntityCode": self.financial_entity_code,
                "EntityCard": "",
                "Exemption": "S"
            },
            "ScheduleDate": slot['SlotDateTime'],
            "Duration": slot['Duration'],
            "Origin": "MALO_ADMIN",
            "BookingID": slot['BookingID'],
            "Patient": {
                "PatientType": "MC",
                "PatientID": self.patient_id
            },
        }
        
        if is_reschedule:
            appointment_data["RescheduleFlag"] = True
            appointment_data["Episode"] = {
                "EpisodeType": episode_type,
                "EpisodeID": episode_id
            }
        else:
            appointment_data["FirstTime"] = False
            appointment_data["episode"] = {
                "EpisodeType": "Ficha-ID",
                "EpisodeID": self.patient_id
            }
            appointment_data["Module"] = "ATDWEB_VALIDATEAPPOINTMENT"
        
        request_body = [appointment_data]
        
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment"
        
        try:
            response = self.session.post(
                endpoint,
                headers=self._get_auth_headers(),
                json=request_body
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for errors in response
                if isinstance(data, dict):
                    if 'errorDetails' in data and data['errorDetails']:
                        error_msg = data['errorDetails']
                        print(f"  FAIL: Glintt error - {error_msg}")
                        return None
                    
                    appointment_id = data.get('appointmentID')
                    if appointment_id:
                        print(f"  Success: Appointment ID = {appointment_id}")
                
                return data
            else:
                print(f"  FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"  Error details: {error_data}")
                except Exception:
                    print(f"  Response: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"  FAIL: Error - {str(e)}")
            return None
    
    def get_appointments(
        self,
        start_date: str,
        end_date: str,
        doctor_code: Optional[str] = None,
        status: str = "SCHEDULED"
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Verify appointments via GET /Appointment endpoint.
        
        Args:
            start_date: Start date (ISO datetime)
            end_date: End date (ISO datetime)
            doctor_code: Optional doctor filter
            status: Appointment status filter
        
        Returns:
            List of appointments, or None on error.
        """
        print(f"Verifying appointments: {start_date} to {end_date}")
        
        endpoint = f"{self.base_url}/Hms.OutPatient.Api/hms/outpatient/Appointment"
        
        # Build query params
        params = {
            'beginDate': start_date,
            'endDate': end_date,
            'status': status,
            'skip': '0',
            'take': '100',
        }
        
        if doctor_code:
            params['doctorCode'] = doctor_code
        
        try:
            response = self.session.get(
                endpoint,
                headers=self._get_auth_headers(),
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    print(f"  Found {len(data)} appointments")
                    return data
                else:
                    print(f"  Unexpected response format")
                    return None
            else:
                print(f"  FAIL: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"  FAIL: Error - {str(e)}")
            return None
    
    def find_appointment_by_time(
        self,
        appointments: List[Dict[str, Any]],
        target_datetime: str,
        patient_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find an appointment matching the target time and patient.
        
        Args:
            appointments: List of appointments
            target_datetime: Expected appointment time (ISO format)
            patient_id: Patient ID to match
        
        Returns:
            Matching appointment or None.
        """
        # Parse target time (remove timezone info for comparison)
        target_time = target_datetime.replace('Z', '').split('.')[0]
        
        for apt in appointments:
            apt_time = apt.get('appointmentHour', '').replace('Z', '').split('.')[0]
            apt_patient = apt.get('patientIdentifier', {}).get('id', '')
            
            if apt_time == target_time and apt_patient == patient_id:
                return apt
        
        return None








