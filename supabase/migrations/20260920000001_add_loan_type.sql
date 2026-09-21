-- Classifies loans for market-rate comparisons while preserving existing records.
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS loan_type text NOT NULL DEFAULT 'CONSUMPTION';

UPDATE loans
  SET loan_type = 'CONSUMPTION'
  WHERE loan_type IS NULL;

ALTER TABLE loans
  ALTER COLUMN loan_type SET DEFAULT 'CONSUMPTION',
  ALTER COLUMN loan_type SET NOT NULL;

ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS loans_loan_type_valid;

ALTER TABLE loans
  ADD CONSTRAINT loans_loan_type_valid
  CHECK (loan_type IN (
    'CONSUMPTION',
    'VEHICLE',
    'MORTGAGE',
    'SMALL_BUSINESS',
    'MICROENTERPRISE',
    'OTHER'
  ));

COMMENT ON COLUMN loans.loan_type IS
  'Loan classification used to select the relevant official market-rate benchmark.';
