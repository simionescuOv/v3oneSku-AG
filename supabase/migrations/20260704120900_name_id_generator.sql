-- SPEC_DatabaseSchema_v3 §6.1, SPEC_LocalFilter_v3 §5.1 — generator NameID.
-- Cuvânt EN lizibil; la coliziune, retry cu combinație adjectiv-substantiv;
-- fallback garantat: substantiv + sufix numeric (spațiul practic inepuizabil
-- la scara vizată — mii de produse/tenant).
create or replace function generate_name_id(p_tenant_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_nouns text[] := array[
    'carrot','meadow','comet','lantern','harbor','cinder','willow','ember','granite','thicket',
    'otter','falcon','marble','quartz','ridge','brook','hazel','linden','cobalt','amber',
    'birch','cedar','coral','delta','ferry','glacier','heron','indigo','jasper','kestrel',
    'lagoon','maple','nectar','opal','pebble','quokka','raven','saffron','tundra','umber',
    'violet','walnut','yucca','zephyr','sparrow','thistle','canyon','meridian','anchor','basalt'
  ];
  v_adjectives text[] := array[
    'brave','quiet','swift','golden','silver','gentle','bold','calm','bright','clever',
    'eager','fierce','humble','jolly','keen','lively','merry','noble','proud','rustic',
    'sturdy','tidy','urban','vivid','warm','young','zealous','azure','crimson','dusty',
    'emerald','frosty','hollow','ivory','jade','lunar','misty','olive','coral','maroon'
  ];
  v_candidate text;
  i integer;
begin
  -- 1) cuvânt simplu
  for i in 1..8 loop
    v_candidate := v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
    if not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;

  -- 2) combinație adjectiv-substantiv (ex: brave-carrot)
  for i in 1..8 loop
    v_candidate :=
      v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int]
      || '-' ||
      v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
    if not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;

  -- 3) fallback garantat: substantiv + sufix numeric (ex: carrot-42)
  loop
    v_candidate :=
      v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int]
      || '-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate);
  end loop;

  return v_candidate;
end $$;
