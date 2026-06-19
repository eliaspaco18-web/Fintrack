-- Repair opening card balances so they stay independent from period movement.
-- Current used balance = opening balance + consumptions - payments.
-- Therefore opening balance = current used balance - consumptions + payments.

with movement_totals as (
  select
    c.id,
    coalesce(sum(
      case
        when t.currency = 'PEN' and t.source_account_id = c.account_id then t.amount
        when t.currency = 'PEN' and t.destination_account_id = c.account_id then -t.amount
        else 0
      end
    ), 0) as net_pen,
    coalesce(sum(
      case
        when t.currency = 'USD' and t.source_account_id = c.account_id then t.amount
        when t.currency = 'USD' and t.destination_account_id = c.account_id then -t.amount
        else 0
      end
    ), 0) as net_usd
  from public.credits c
  left join public.transactions t
    on t.user_id = c.user_id
   and t.type = 'EXPENSE'
   and (
    t.source_account_id = c.account_id
    or t.destination_account_id = c.account_id
   )
  where c.credit_type = 'CREDIT_CARD'
    and c.account_id is not null
  group by c.id
)
update public.credits c
set
  initial_used_amount_pen = greatest(
    round((coalesce(c.used_amount_pen, case when c.currency = 'PEN' then c.used_amount else 0 end) - movement_totals.net_pen)::numeric, 2),
    0
  ),
  initial_used_amount_usd = greatest(
    round((coalesce(c.used_amount_usd, case when c.currency = 'USD' then c.used_amount else 0 end) - movement_totals.net_usd)::numeric, 2),
    0
  )
from movement_totals
where c.id = movement_totals.id;
