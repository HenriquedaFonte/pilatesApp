const url = 'https://kezfpyhsejhjcvlbmejq.supabase.co/rest/v1/testimonials?is_active=eq.true';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlemZweWhzZWpoamN2bGJtZWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NTA4MDAsImV4cCI6MjA3MjUyNjgwMH0.sVMhPrmOZauv_DpGWAHNu7enfA_3lKgRMdKtQnJHEnY';

fetch(url, {
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('FETCHED TESTIMONIALS RAW DATA:');
  data.forEach((row, i) => {
    console.log(`\n--- Testimonial ${i + 1} ---`);
    console.log(`Author: ${JSON.stringify(row.author_name)} (Type: ${typeof row.author_name})`);
    console.log(`City: ${JSON.stringify(row.city)} (Type: ${typeof row.city})`);
    console.log(`State: ${JSON.stringify(row.state)} (Type: ${typeof row.state})`);
    console.log(`Text: ${JSON.stringify(row.text)} (Type: ${typeof row.text})`);
  });
})
.catch(err => console.error('Error fetching:', err));
