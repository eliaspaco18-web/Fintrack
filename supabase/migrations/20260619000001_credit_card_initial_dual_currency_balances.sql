-- Keep opening card balances separate from the current used balance.
-- Current used balance changes with movements; initial balances are the opening
-- debt from the statement used when the card was registered.

alter table public.credits
  add column if not exists initial_used_amount_pen numeric(15,2) not null default 0,
  add column if not exists initial_used_amount_usd numeric(15,2) not null default 0;

update public.credits
set
  initial_used_amount_pen = case
    when credit_type = 'CREDIT_CARD' and initial_used_amount_pen = 0 then used_amount_pen
    else initial_used_amount_pen
  end,
  initial_used_amount_usd = case
    when credit_type = 'CREDIT_CARD' and initial_used_amount_usd = 0 then used_amount_usd
    else initial_used_amount_usd
  end
where credit_type = 'CREDIT_CARD';

alter table public.credits
  drop constraint if exists credits_initial_used_amount_pen_nonnegative,
  drop constraint if exists credits_initial_used_amount_usd_nonnegative;

alter table public.credits
  add constraint credits_initial_used_amount_pen_nonnegative check (initial_used_amount_pen >= 0),
  add constraint credits_initial_used_amount_usd_nonnegative check (initial_used_amount_usd >= 0);
