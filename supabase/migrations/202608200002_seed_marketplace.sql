insert into public.categories(name,slug,sort_order) values
('Burgers','burgers',10),('Poulet','poulet',20),('Pizza','pizza',30),('Cuisine ivoirienne','cuisine-ivoirienne',40),
('Cuisine africaine','cuisine-africaine',50),('Grillades','grillades',60),('Fast-food','fast-food',70),('Sandwichs & wraps','sandwichs-wraps',80),
('Shawarma','shawarma',90),('Poisson & fruits de mer','poisson-fruits-de-mer',100),('Plats de riz','plats-de-riz',110),('Pâtes','pates',120),
('Salades','salades',130),('Accompagnements','accompagnements',140),('Petit-déjeuner & brunch','petit-dejeuner-brunch',150),
('Desserts & pâtisseries','desserts-patisseries',160),('Glaces','glaces',170),('Boissons','boissons',180),
('Jus & boissons naturelles','jus-boissons-naturelles',190),('Café & boissons chaudes','cafe-boissons-chaudes',200),
('Healthy','healthy',210),('Végétarien','vegetarien',220) on conflict(slug) do nothing;
insert into public.cuisine_types(name,slug,sort_order) values
('Ivoirien','ivoirien',10),('Africain','africain',20),('Libanais','libanais',30),('Asiatique','asiatique',40),
('Italien','italien',50),('Français','francais',60),('Américain','americain',70),('Indien','indien',80),
('Méditerranéen','mediterraneen',90),('Fast-food','fast-food',100),('Healthy','healthy',110) on conflict(slug) do nothing;
insert into public.restaurants(id,name,slug,description,phone,address,commune,average_prep_minutes,operating_status,validation_status)
values('10000000-0000-4000-8000-000000000001','Come & Eat Cocody','come-eat-cocody','Cuisine généreuse préparée à la commande.','+225 07 48 99 22 11','Cocody Riviera 3','Cocody',25,'open','approved'),
('10000000-0000-4000-8000-000000000002','Come & Eat Plateau','come-eat-plateau','Le goût Come & Eat au cœur du Plateau.','+225 07 48 99 22 11','Plateau','Plateau',20,'paused','approved') on conflict(slug) do nothing;
insert into public.restaurant_hours(restaurant_id,day_of_week,opens_at,closes_at,is_closed)
select r.id,d,'11:00','23:00',false from public.restaurants r cross join generate_series(0,6) d where r.slug in ('come-eat-cocody','come-eat-plateau') on conflict do nothing;
insert into public.products(restaurant_id,category_id,name,slug,sku,description,base_price,availability,is_featured,moderation_status)
select r.id,c.id,v.name,v.slug,v.sku,v.description,v.price,true,v.featured,'approved'::public.moderation_status
from (values
('Burger Poulet','burger-poulet','CEA-BUR-1001','Poulet croustillant, salade fraîche et sauce maison.',4500,true,'burgers'),
('Burger Bœuf','burger-boeuf','CEA-BUR-1002','Steak de bœuf, cheddar et oignons confits.',5000,true,'burgers'),
('Formule Burger','formule-burger','CEA-FOR-1003','Burger, accompagnement et boisson.',7000,true,'burgers'),
('Alloco','alloco','CEA-ALL-1004','Bananes plantain mûres, frites et dorées.',2000,true,'accompagnements'),
('Jus de Bissap','jus-de-bissap','CEA-BIS-1005','Infusion d’hibiscus fraîche et parfumée.',1000,false,'boissons'))
as v(name,slug,sku,description,price,featured,category_slug)
join public.restaurants r on r.slug='come-eat-cocody' join public.categories c on c.slug=v.category_slug
on conflict(restaurant_id,slug) do nothing;
insert into public.product_option_groups(id,restaurant_id,name,type,is_required,min_choices,max_choices,sort_order)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Accompagnement','accompaniment',true,1,1,10),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Boisson','drink',false,0,1,20),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Suppléments','supplement',false,0,null,30) on conflict(id) do nothing;
insert into public.product_options(group_id,name,price_delta,sort_order) values
('20000000-0000-4000-8000-000000000001','Frites',0,10),('20000000-0000-4000-8000-000000000001','Alloco',500,20),
('20000000-0000-4000-8000-000000000001','Attiéké',300,30),('20000000-0000-4000-8000-000000000002','Eau',500,10),
('20000000-0000-4000-8000-000000000002','Bissap',1000,20),('20000000-0000-4000-8000-000000000003','Fromage',500,10),
('20000000-0000-4000-8000-000000000003','Viande supplémentaire',1500,20);
insert into public.product_option_group_links(product_id,group_id,sort_order)
select p.id,g.id,g.sort_order from public.products p join public.product_option_groups g on g.restaurant_id=p.restaurant_id where p.slug='formule-burger' on conflict do nothing;
insert into public.site_settings(key,value,is_public) values
('brand','{"name":"Come & Eat","tagline":"Le goût qui parle"}',true),
('contact','{"phone":"+225 07 48 99 22 11","email":"bonjour@come-eat.local","address":"Abidjan, Côte d’Ivoire"}',true),
('hours','{"label":"Tous les jours · 11h–23h"}',true),
('announcement','{"text":"Livraison à Abidjan · 7j/7"}',true),
('hero','{"title":"Le goût qui parle.","body":"Des recettes généreuses, des produits frais et une cuisine faite au moment de votre commande."}',true),
('footer','{"description":"Une cuisine simple et généreuse, préparée avec soin à Abidjan."}',true) on conflict(key) do nothing;
insert into public.homepage_sections(section_key,title,subtitle,body,sort_order,is_visible)
values('concept','Bon, frais, sans détour.','Notre façon de cuisiner','Trois engagements simples qui se retrouvent dans chaque commande.',20,true),
('final_cta','Votre repas, simplement.','À table','Choisissez vos plats, personnalisez-les et indiquez où vous livrer.',90,true) on conflict(section_key) do nothing;
