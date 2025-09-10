#!/bin/bash

# Read the CSV file and update shipping costs
tail -n +2 shopifyowners.csv | while IFS=',' read -r date ordernumber owner channel shipping; do
    echo "Updating order $ordernumber with shipping cost $shipping"
    PGPASSWORD=kinetic_password_2024 psql -h localhost -U kinetic_user -d kinetic_app -c "UPDATE shopify_orders SET shippingcost = $shipping WHERE ordernumber = '$ordernumber';" > /dev/null 2>&1
done

echo "Shipping costs update complete!"

