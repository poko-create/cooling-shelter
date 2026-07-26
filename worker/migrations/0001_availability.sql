create table if not exists availability (
  shelter_id text primary key,
  status text not null check (status in ('open', 'busy', 'full')),
  updated_at text not null
);

create table if not exists availability_history (
  id integer primary key autoincrement,
  shelter_id text not null,
  status text not null check (status in ('open', 'busy', 'full')),
  updated_at text not null
);

create index if not exists availability_history_shelter_time_idx
  on availability_history (shelter_id, updated_at);
