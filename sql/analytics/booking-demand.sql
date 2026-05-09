-- =========================================
-- Casas mais buscadas
-- =========================================

select
  house_name,
  count(*) as total_searches
from booking_events
where event_type = 'booking_search'
group by house_name
order by total_searches desc;

-- =========================================
-- Datas mais procuradas
-- =========================================

select
  checkin,
  checkout,
  count(*) as searches
from booking_events
where event_type = 'booking_search'
group by checkin, checkout
order by searches desc;

-- =========================================
-- Demanda Réveillon
-- =========================================

select
  house_name,
  count(*) as reveillon_interest
from booking_events
where checkin between '2026-12-15' and '2027-01-06'
group by house_name
order by reveillon_interest desc;