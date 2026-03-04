-- Remove previous policies and create bypass for service role
-- This allows webhook to add items after successful payment

-- Drop previous policies if they exist
DROP POLICY IF EXISTS "Service role can manage user_items" ON user_items;
DROP POLICY IF EXISTS "Service role can manage payments" ON payments;

-- Create PERMISSIVE policies for service_role that bypass all restrictions
CREATE POLICY "service_role_bypass_user_items" ON user_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_payments" ON payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant explicit permissions to service_role
GRANT ALL ON user_items TO service_role;
GRANT ALL ON payments TO service_role;
