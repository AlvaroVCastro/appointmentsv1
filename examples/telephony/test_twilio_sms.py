from twilio.rest import Client
from datetime import datetime

# =============================================================================
# CONFIGURATION - Edit these values as needed
# =============================================================================

# Twilio Access Codes
TWILIO_ACCOUNT_SID = ""      # Your Twilio Account SID
TWILIO_AUTH_TOKEN = ""        # Your Twilio Auth Token

# Messaging Service with Alpha Sender
MESSAGING_SERVICE_SID = ""  # Your Twilio Messaging Service SID

# Recipient phone number
PHONE_NUMBER = "+"                    # Recipient's phone number (must be in E.164 format)

# Message content
MESSAGE_TEXT = "Hello! This is a test message from Twilio."


def send_sms():
    """Send an SMS message using Twilio"""
    try:
        # Initialize the Twilio client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        # Log the attempt
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] Sending message to {PHONE_NUMBER}...")
        print(f"Messaging Service SID: {MESSAGING_SERVICE_SID}")
        print(f"Message: {MESSAGE_TEXT}")
        
        # Send the message using Messaging Service with Alpha Sender
        message = client.messages.create(
            body=MESSAGE_TEXT,
            messaging_service_sid=MESSAGING_SERVICE_SID,
            to=PHONE_NUMBER
        )

        print("\n✅ Message sent successfully!")
        print(f"Message SID: {message.sid}")
        print(f"Status: {message.status}")
        print(f"Date Created: {message.date_created}")
        
        return message

    except Exception as e:
        print(f"\n❌ Error sending message: {str(e)}")
        return None


if __name__ == "__main__":
    print("="*60)
    print("📱 Twilio SMS Test")
    print("="*60)
    print(f"Account SID: {TWILIO_ACCOUNT_SID[:10]}..." if len(TWILIO_ACCOUNT_SID) > 10 else f"Account SID: {TWILIO_ACCOUNT_SID}")
    print(f"Messaging Service SID: {MESSAGING_SERVICE_SID[:10]}..." if len(MESSAGING_SERVICE_SID) > 10 else f"Messaging Service SID: {MESSAGING_SERVICE_SID}")
    print(f"Recipient: {PHONE_NUMBER}")
    print("="*60)
    print()
    
    send_sms()

