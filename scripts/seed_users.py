import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.Models.user import User

USERS = [
    ("Admin", "User", "admin@foodstack.local", "Admin123!", "admin"),
    ("Staff", "User", "staff@foodstack.local", "Staff123!", "staff"),
    ("Test", "Customer", "customer@foodstack.local", "Customer123!", "customer"),
]

for name, lastname, email, password, role in USERS:
    if User.get_by_email(email):
        print(f"exists: {email}")
        continue
    u = User()
    u.name, u.lastname, u.phoneNumber, u.email = name, lastname, "5551234567", email
    u.password = password
    u.role = role
    print(f"created: {email} (id {u.add()})")
