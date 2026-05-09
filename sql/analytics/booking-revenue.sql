-- =========================================
-- Receita potencial pesquisada
-- =========================================

select
  house_name,
  sum(estimated_total) as potential_revenue
from booking_events
where estimated_total is not null
group by house_name
order by potential_revenue desc;