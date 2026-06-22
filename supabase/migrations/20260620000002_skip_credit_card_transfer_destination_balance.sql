-- =============================================================================
-- Credit-card technical accounts do not represent liquid cash.
-- Transfers into a CREDIT_CARD account are card payments and must reduce
-- credits.used_amount_* only; they must not increase accounts.balance.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_source_type account_type;
  v_new_source_type account_type;
  v_old_destination_type account_type;
  v_new_destination_type account_type;
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    SELECT type INTO v_old_source_type FROM accounts WHERE id = OLD.source_account_id;
    IF OLD.destination_account_id IS NOT NULL THEN
      SELECT type INTO v_old_destination_type FROM accounts WHERE id = OLD.destination_account_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT type INTO v_new_source_type FROM accounts WHERE id = NEW.source_account_id;
    IF NEW.destination_account_id IS NOT NULL THEN
      SELECT type INTO v_new_destination_type FROM accounts WHERE id = NEW.destination_account_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';

    ELSIF NEW.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';

    ELSIF NEW.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.destination_account_id
          AND v_new_destination_type <> 'CREDIT_CARD';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';

    ELSIF OLD.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';

    ELSIF OLD.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.destination_account_id
          AND v_old_destination_type <> 'CREDIT_CARD';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';
    ELSIF OLD.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';
    ELSIF OLD.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id
          AND v_old_source_type <> 'CREDIT_CARD';
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.destination_account_id
          AND v_old_destination_type <> 'CREDIT_CARD';
    END IF;

    IF NEW.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';
    ELSIF NEW.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';
    ELSIF NEW.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id
          AND v_new_source_type <> 'CREDIT_CARD';
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.destination_account_id
          AND v_new_destination_type <> 'CREDIT_CARD';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
