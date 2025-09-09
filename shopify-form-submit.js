// Add this JavaScript to your Shopify contact form template
// Place it before the closing </div> of the form-vertical div

<script>
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form[action*="contact"]');
  
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Get form data
      const formData = new FormData(form);
      const data = {
        name: formData.get('contact[name]'),
        inquiry_type: formData.get('contact[inquiry_type]'),
        phone: formData.get('contact[phone]'),
        email: formData.get('contact[email]'),
        usage: formData.get('contact[usage]'),
        number_of_dogs: formData.get('contact[number_of_dogs]'),
        body: formData.get('contact[body]')
      };
      
      // Validate required fields
      if (!data.name || !data.email || !data.inquiry_type || !data.body) {
        alert('Please fill in all required fields.');
        return;
      }
      
      try {
        // Submit to your database API
        const response = await fetch('https://team.kineticdogfood.com/api/inquiries/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Show success message
          const successMessage = document.createElement('div');
          successMessage.className = 'note note--success';
          successMessage.textContent = 'Thank you for your inquiry! We will get back to you soon.';
          
          // Insert success message before the form
          form.parentNode.insertBefore(successMessage, form);
          
          // Reset form
          form.reset();
          
          // Remove success message after 5 seconds
          setTimeout(() => {
            if (successMessage.parentNode) {
              successMessage.parentNode.removeChild(successMessage);
            }
          }, 5000);
          
        } else {
          throw new Error(result.error || 'Failed to submit inquiry');
        }
        
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('There was an error submitting your inquiry. Please try again.');
      }
    });
  }
});
</script>

