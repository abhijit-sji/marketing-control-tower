-- Insert LinkedIn analytics data for Shahed Islam
-- Based on exported LinkedIn analytics data showing top performing posts

INSERT INTO content_performance_metrics (
  leader_id, 
  posted_date, 
  impressions, 
  engagement_score, 
  reach_count,
  post_url,
  audience,
  notes
) VALUES 
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-09-05', 9964, 388, 9964, 'https://www.linkedin.com/feed/update/urn:li:activity:7369704614394380288', 'Software Engineers, Founders', 'Top performing post - viral reach'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-04-11', 7321, 168, 7321, 'https://www.linkedin.com/feed/update/urn:li:activity:7316301475700236288', 'Tech Leaders', 'High impressions with strong engagement'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-09-02', 6606, 189, 6606, 'https://www.linkedin.com/feed/update/urn:li:activity:7368719308035756034', 'Founders, CEOs', 'Leadership content resonated well'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-12-26', 5335, 179, 5335, 'https://www.linkedin.com/feed/update/urn:li:activity:7278088121705979904', 'Tech Community', 'Holiday post with strong engagement'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-01-10', 5136, 120, 5136, 'https://www.linkedin.com/feed/update/urn:li:activity:7283475196139737090', 'Software Developers', 'Technical insights gained traction'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-05-22', 4986, 110, 4986, 'https://www.linkedin.com/feed/update/urn:li:activity:7331287808562589698', 'Marketing Managers', 'Business growth content'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-07-26', 4304, 114, 4304, 'https://www.linkedin.com/feed/update/urn:li:activity:7354893360475578368', 'Product Managers', 'Product development insights'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-03-05', 4015, 97, 4015, 'https://www.linkedin.com/feed/update/urn:li:activity:7303036630032961537', 'Tech Leaders', 'Industry trends discussion'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-12-20', 3946, 90, 3946, 'https://www.linkedin.com/feed/update/urn:li:activity:7275748059148386304', 'Founders', 'Year-end reflections'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-01-02', 3873, 158, 3873, 'https://www.linkedin.com/feed/update/urn:li:activity:7280600346706513921', 'Software Engineers', 'New year goals and strategy'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-01-30', 3817, 116, 3817, 'https://www.linkedin.com/feed/update/urn:li:activity:7290715405877170176', 'Tech Community', 'Monthly insights wrap-up'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-11-11', 3746, 97, 3746, 'https://www.linkedin.com/feed/update/urn:li:activity:7261720587268493313', 'Product Managers', 'Product strategy content'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-05-01', 3739, 111, 3739, 'https://www.linkedin.com/feed/update/urn:li:activity:7323677616127774720', 'Marketing Managers', 'Growth marketing tactics'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-11-01', 3734, 187, 3734, 'https://www.linkedin.com/feed/update/urn:li:activity:7258085375976386560', 'Founders, CEOs', 'Startup insights - high engagement'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-11-14', 3731, 89, 3731, 'https://www.linkedin.com/feed/update/urn:li:activity:7262830396340416512', 'Tech Leaders', 'Leadership lessons'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-09-27', 3716, 140, 3716, 'https://www.linkedin.com/feed/update/urn:li:activity:7377692245417963520', 'Software Engineers', 'Technical deep dive'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-12-13', 3668, 132, 3668, 'https://www.linkedin.com/feed/update/urn:li:activity:7273320805185249280', 'Tech Community', 'Year-end industry trends'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-08-19', 3652, 126, 3652, 'https://www.linkedin.com/feed/update/urn:li:activity:7363398496135106560', 'Product Managers', 'AI and product development'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2024-10-22', 3620, 90, 3620, 'https://www.linkedin.com/feed/update/urn:li:activity:7254595484713955329', 'Software Developers', 'Development best practices'),
  ('fb435704-194b-42dc-b0ed-fc744ca33099', '2025-09-20', 3509, 94, 3509, 'https://www.linkedin.com/feed/update/urn:li:activity:7375159549470720000', 'Tech Leaders', 'Strategic planning insights')
ON CONFLICT DO NOTHING;