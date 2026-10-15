-- Draft estimates must never trigger preparation or acquire a paid status by themselves.
create function public.cancel_draft_meal(target uuid) returns void
language plpgsql security definer set search_path=public as $$
declare plan_id uuid;meal public.scheduled_meals;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select p.id into plan_id from public.meal_plans p join public.scheduled_meals m on m.plan_id=p.id where m.id=target and p.user_id=auth.uid() and p.status='draft' for update of p;
 if not found then raise exception 'DRAFT_NOT_EDITABLE';end if;
 select * into meal from public.scheduled_meals where id=target for update;
 if meal.status='cancelled' then return;end if;
 if meal.status<>'requested' or meal.order_id is not null or meal.payment_status='paid' then raise exception 'CONTACT_SUPPORT';end if;
 update public.scheduled_meals set status='cancelled' where id=target;
 update public.subscription_consumptions set status='released' where meal_id=target and status='reserved';
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(target,auth.uid(),meal.status,'cancelled','Repas retiré du brouillon par le client. Aucun remboursement déclenché.');
end $$;
revoke all on function public.cancel_draft_meal(uuid) from public,anon;
grant execute on function public.cancel_draft_meal(uuid) to authenticated;

create or replace function public.update_scheduled_meal(target uuid,next_status text,note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare meal public.scheduled_meals;manager boolean;
begin
 select * into meal from public.scheduled_meals where id=target for update;if not found then raise exception 'NOT_FOUND';end if;
 manager:=public.has_platform_permission('planning.manage');
 if not manager and not public.is_restaurant_member(meal.restaurant_id) then raise exception 'FORBIDDEN';end if;
 if next_status is null or length(coalesce(note,''))>4000 then raise exception 'INVALID_INPUT';end if;
 if next_status=meal.status then return;end if;
 if meal.status in ('completed','cancelled') then raise exception 'TERMINAL_STATE';end if;
 if next_status in ('confirmed','preparing','ready','completed') then
  if meal.order_id is null then raise exception 'ORDER_NOT_MATERIALIZED';end if;
  if not exists(select 1 from public.orders o join public.restaurant_orders ro on ro.order_id=o.id join public.meal_plans p on p.id=meal.plan_id where o.id=meal.order_id and o.customer_user_id=p.user_id and ro.restaurant_id=meal.restaurant_id and (o.payment_method='cash' or ro.payment_status='paid')) then raise exception 'ORDER_NOT_PAYABLE';end if;
 end if;
 if next_status='cancelled' and meal.order_id is not null then raise exception 'USE_ORDER_CANCELLATION';end if;
 if not (next_status='confirmed' and meal.status='requested' or next_status='preparing' and meal.status='confirmed' and meal.scheduled_at<=now()+interval '2 hours' or next_status='ready' and meal.status='preparing' or next_status='completed' and meal.status='ready' or next_status in ('cancelled','incident') and manager and length(trim(coalesce(note,'')))>=5) then raise exception 'INVALID_TRANSITION';end if;
 update public.scheduled_meals set status=next_status where id=target;
 if next_status='cancelled' then update public.subscription_consumptions set status='released' where meal_id=target and status='reserved';end if;
 if next_status='completed' then update public.subscription_consumptions set status='consumed' where meal_id=target and status='reserved';end if;
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(target,auth.uid(),meal.status,next_status,note);
end $$;
