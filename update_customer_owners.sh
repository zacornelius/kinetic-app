#!/bin/bash

# Create a mapping file from CSV
echo "Creating customer-owner mapping..."

# Process CSV and create updates
tail -n +2 shopifyowners.csv | while IFS=',' read -r date ordernumber owner channel shipping; do
    # Get customer email for this order
    customer_email=$(PGPASSWORD=kinetic_password_2024 psql -h localhost -U kinetic_user -d kinetic_app -t -c "SELECT customeremail FROM shopify_orders WHERE ordernumber = '$ordernumber';" | tr -d ' ')
    
    if [ ! -z "$customer_email" ]; then
        echo "Updating customer $customer_email to owner $owner"
        PGPASSWORD=kinetic_password_2024 psql -h localhost -U kinetic_user -d kinetic_app -c "UPDATE customers SET assignedto = '$owner' WHERE email = '$customer_email';" > /dev/null 2>&1
    fi
done

echo "Customer owner updates complete!"

