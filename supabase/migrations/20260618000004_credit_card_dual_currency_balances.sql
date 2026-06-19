-- Store credit-card statement balances in both currencies.
-- Bank statements can carry separate PEN and USD consumption balances even when
-- the credit line itself is configured in only one currency.

alter table public.credits
  add column if not exists credit_limit_pen numeric(15,2) not null default 0,
  add column if not exists credit_limit_usd numeric(15,2) not null default 0,
  add column if not exists used_amount_pen numeric(15,2) not null default 0,
  add column if not exists used_amount_usd numeric(15,2) not null default 0;

update public.credits
set
  credit_limit_pen = case when currency = 'PEN' then credit_limit else credit_limit_pen end,
  credit_limit_usd = case when currency = 'USD' then credit_limit else credit_limit_usd end,
  used_amount_pen = case when currency = 'PEN' then used_amount else used_amount_pen end,
  used_amount_usd = case when currency = 'USD' then used_amount else used_amount_usd end
where credit_type = 'CREDIT_CARD';

alter table public.credits
  drop constraint if exists credits_credit_limit_pen_nonnegative,
  drop constraint if exists credits_credit_limit_usd_nonnegative,
  drop constraint if exists credits_used_amount_pen_nonnegative,
  drop constraint if exists credits_used_amount_usd_nonnegative;

alter table public.credits
  add constraint credits_credit_limit_pen_nonnegative check (credit_limit_pen >= 0),
  add constraint credits_credit_limit_usd_nonnegative check (credit_limit_usd >= 0),
  add constraint credits_used_amount_pen_nonnegative check (used_amount_pen >= 0),
  add constraint credits_used_amount_usd_nonnegative check (used_amount_usd >= 0);
