-- 되돌리기: 20261124_cohort_renumber_close.sql
do $$
begin
  delete from product_cohorts where kind='course' and product_id in
    (16,17,18,38,41,47,55,67,71,88,90,92,94,95,117,118,119,123,124,125,127,128,134,136,
     13,43,49,72,73,74,75,76,85,86,51,77,78,103,104,105);
  delete from curriculum_items where course_id in (110,111,112) and cohort_no = 4
     and coalesce(video_url,'') = '' and coalesce(video_urls,'[]'::jsonb) = '[]'::jsonb;  -- 4기에 영상을 넣은 항목은 남김
  update curriculum_items set cohort_no = 1 where course_id in (110,111,112) and cohort_no = 3;
  update product_cohorts set no = no - 2, name = (no - 2) || '기' where kind='course' and product_id in (110,111,112);
  update courses set is_on_sale = true where id in (35,92,134);
end $$;
