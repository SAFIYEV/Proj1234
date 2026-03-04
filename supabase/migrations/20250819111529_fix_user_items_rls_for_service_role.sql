-- Allow service role to bypass RLS for user_items table
-- This is needed for webhook to add items after successful payment

-- Add policy for service role to insert/update user_items
CREATE POLICY "Service role can manage user_items" ON user_items
  FOR ALL USING (auth.role() = 'service_role');

-- Also allow service role to manage payments table
CREATE POLICY "Service role can manage payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');
