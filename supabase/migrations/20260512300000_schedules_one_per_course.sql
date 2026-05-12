-- 강의 1개당 schedules row 를 1개로 통일.
-- 같은 course_id 가 여러 행을 가지는 경우 가장 최근 scheduled_at 만 남기고 나머지는 삭제.
DELETE FROM schedules
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY course_id ORDER BY scheduled_at DESC) AS rn
    FROM schedules
    WHERE course_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- schedules 의 표시 정보(title, instructor_id) 를 강의의 현재 값으로 강제 동기화.
UPDATE schedules s
SET title = c.title,
    instructor_id = c.instructor_id
FROM courses c
WHERE s.course_id = c.id;
