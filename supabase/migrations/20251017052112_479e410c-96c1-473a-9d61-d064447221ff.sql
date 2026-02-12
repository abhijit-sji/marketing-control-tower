-- Seed comprehensive analytics data for LeadsLift brand
-- This creates 45 days of realistic dummy data with trends

-- Delete existing analytics data for this brand to start fresh
DELETE FROM brand_analytics_data WHERE brand_id = '4e5aa3d5-1f39-4159-bfd4-b112bc6b295f';

-- Generate 45 days of daily analytics data
DO $$
DECLARE
  brand_uuid uuid := '4e5aa3d5-1f39-4159-bfd4-b112bc6b295f';
  start_date date := CURRENT_DATE - INTERVAL '45 days';
  day_offset int;
  base_visitors int;
  daily_visitors int;
  is_weekend boolean;
BEGIN
  FOR day_offset IN 0..44 LOOP
    -- Determine if weekend (lower traffic)
    is_weekend := EXTRACT(DOW FROM start_date + day_offset) IN (0, 6);
    
    -- Calculate base visitors with growth trend (850 -> 1100 over 45 days)
    base_visitors := 850 + (day_offset * 5);
    
    -- Apply weekend penalty and add some randomness
    IF is_weekend THEN
      daily_visitors := base_visitors * 0.65 + (random() * 100)::int;
    ELSE
      daily_visitors := base_visitors + (random() * 150)::int;
    END IF;
    
    INSERT INTO brand_analytics_data (
      brand_id, 
      date_range_start, 
      date_range_end, 
      data_type, 
      metrics, 
      dimensions
    )
    VALUES (
      brand_uuid,
      start_date + day_offset,
      start_date + day_offset,
      'google_analytics',
      jsonb_build_object(
        'pageviews', (daily_visitors * (1.8 + random() * 0.4))::int,
        'unique_visitors', daily_visitors,
        'sessions', (daily_visitors * (1.05 + random() * 0.1))::int,
        'bounce_rate', (38 + random() * 15)::numeric(5,2),
        'avg_session_duration', (160 + (random() * 80)::int)::int,
        'pages_per_session', (2.8 + random() * 0.8)::numeric(3,2),
        'new_visitors', (daily_visitors * (0.55 + random() * 0.1))::int,
        'returning_visitors', (daily_visitors * (0.45 - random() * 0.1))::int,
        'goal_completions', (daily_visitors * (0.04 + random() * 0.02))::int,
        'conversion_rate', (4.0 + random() * 2.0)::numeric(5,2)
      ),
      jsonb_build_object(
        'channels', jsonb_build_object(
          'Organic Search', (daily_visitors * 0.47)::int,
          'Direct', (daily_visitors * 0.27)::int,
          'Social Media', (daily_visitors * 0.13)::int,
          'Referral', (daily_visitors * 0.08)::int,
          'Paid Search', (daily_visitors * 0.05)::int
        ),
        'top_pages', jsonb_build_array(
          jsonb_build_object('path', '/services', 'views', (daily_visitors * 0.35)::int, 'uniqueVisitors', (daily_visitors * 0.30)::int, 'avgDuration', 245, 'bounceRate', 32.5),
          jsonb_build_object('path', '/about', 'views', (daily_visitors * 0.22)::int, 'uniqueVisitors', (daily_visitors * 0.19)::int, 'avgDuration', 180, 'bounceRate', 45.2),
          jsonb_build_object('path', '/contact', 'views', (daily_visitors * 0.18)::int, 'uniqueVisitors', (daily_visitors * 0.16)::int, 'avgDuration', 120, 'bounceRate', 25.8),
          jsonb_build_object('path', '/blog', 'views', (daily_visitors * 0.15)::int, 'uniqueVisitors', (daily_visitors * 0.13)::int, 'avgDuration', 280, 'bounceRate', 62.3),
          jsonb_build_object('path', '/pricing', 'views', (daily_visitors * 0.10)::int, 'uniqueVisitors', (daily_visitors * 0.09)::int, 'avgDuration', 195, 'bounceRate', 38.7)
        )
      )
    );
  END LOOP;
END $$;