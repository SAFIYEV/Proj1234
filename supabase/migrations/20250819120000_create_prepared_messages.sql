-- Create prepared_messages table for sharing functionality
CREATE TABLE IF NOT EXISTS prepared_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE prepared_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own prepared messages
CREATE POLICY "Users can read their own prepared messages" ON prepared_messages
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Allow users to insert their own prepared messages
CREATE POLICY "Users can insert their own prepared messages" ON prepared_messages
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Allow service role to manage all prepared messages
CREATE POLICY "Service role can manage all prepared messages" ON prepared_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prepared_messages_user_id ON prepared_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_prepared_messages_expires_at ON prepared_messages(expires_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prepared_messages_updated_at 
  BEFORE UPDATE ON prepared_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
