#!/usr/bin/env python3
import csv
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="kinetic_app",
    user="kinetic_user",
    password="kinetic_password_2024"
)
cur = conn.cursor()

# Read CSV and create customer-owner mapping
customer_owners = {}

with open('shopifyowners.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        ordernumber = row['Ordernumber']
        owner = row['Owner']
        
        # Get customer email for this order
        cur.execute("SELECT customeremail FROM shopify_orders WHERE ordernumber = %s", (ordernumber,))
        result = cur.fetchone()
        
        if result:
            customer_email = result[0]
            customer_owners[customer_email] = owner
            print(f"Order {ordernumber}: {customer_email} -> {owner}")

# Update customer assignments
for customer_email, owner in customer_owners.items():
    cur.execute("UPDATE customers SET assignedto = %s WHERE email = %s", (owner, customer_email))
    print(f"Updated customer {customer_email} to owner {owner}")

conn.commit()
cur.close()
conn.close()

print(f"\nUpdated {len(customer_owners)} customers with their correct owners")

