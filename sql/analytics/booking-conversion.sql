-- =========================================
-- Eventos por tipo
-- =========================================

select
  event_type,
  count(*) as total
from booking_events
group by event_type
order by total desc;

-- =========================================
-- Conversão futura
-- =========================================

select
  count(*) filter (
    where event_type = 'booking_search'
  ) as searches,

  count(*) filter (
    where event_type = 'booking_checkout_started'
  ) as checkout_started

from booking_events;