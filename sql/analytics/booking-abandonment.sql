-- =========================================
-- Buscas sem checkout
-- =========================================

select
  house_name,
  checkin,
  checkout,
  count(*) as abandoned_searches
from booking_events
where event_type = 'booking_search'
group by house_name, checkin, checkout
order by abandoned_searches desc;