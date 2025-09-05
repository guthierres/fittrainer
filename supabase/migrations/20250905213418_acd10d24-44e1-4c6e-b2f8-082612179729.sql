-- Phase 1: Fix Critical RLS Security Vulnerabilities

-- Fix personal_trainers table - remove overly permissive policy
DROP POLICY IF EXISTS "Personal trainers data access" ON personal_trainers;

-- Create secure policies for personal_trainers
CREATE POLICY "Trainers can view and update their own data" 
ON personal_trainers 
FOR ALL 
USING (id = (current_setting('request.jwt.claims', true)::json->>'trainer_id')::uuid);

CREATE POLICY "Public read access for active trainers (for login verification)" 
ON personal_trainers 
FOR SELECT 
USING (active = true);

-- Fix students table - remove overly permissive policy  
DROP POLICY IF EXISTS "Trainers can access their students only" ON students;

-- Create secure policies for students
CREATE POLICY "Trainers can access their own students" 
ON students 
FOR ALL 
USING (personal_trainer_id = (current_setting('request.jwt.claims', true)::json->>'trainer_id')::uuid);

CREATE POLICY "Students can view their own data via token" 
ON students 
FOR SELECT 
USING (unique_link_token = current_setting('request.jwt.claims', true)::json->>'student_token');

-- Fix super_admins table - remove overly permissive policy
DROP POLICY IF EXISTS "Super admins can manage their own data" ON super_admins;

-- Create secure policies for super_admins
CREATE POLICY "Super admins can manage their own data only" 
ON super_admins 
FOR ALL 
USING (id = (current_setting('request.jwt.claims', true)::json->>'admin_id')::uuid);

-- Add password hashing to super_admins (prepare for proper auth)
ALTER TABLE super_admins ALTER COLUMN password_hash SET NOT NULL;

-- Update existing super admin with proper hashed password
UPDATE super_admins 
SET password_hash = crypt('Gutim@2028', gen_salt('bf', 12))
WHERE email = 'guthierresc@hotmail.com';

-- Add constraint to prevent empty passwords
ALTER TABLE super_admins ADD CONSTRAINT password_not_empty CHECK (length(password_hash) > 0);