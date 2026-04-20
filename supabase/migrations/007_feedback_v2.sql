-- Extend rec_feedback with richer input fields
-- rating: 0=pass, 1=watch, 2=interested, 3=strong_yes
alter table rec_feedback
  add column if not exists rating  smallint not null default 0,
  add column if not exists tags    text[]   not null default '{}',
  add column if not exists note    text;

-- Backfill rating from the old liked boolean
update rec_feedback
set rating = case when liked then 2 else 0 end
where rating = 0;
