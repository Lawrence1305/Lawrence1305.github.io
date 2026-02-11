// 等待DOM完全加载
document.addEventListener('DOMContentLoaded', function() {
    console.log('网站已加载');
    
    // 这里可以添加交互功能
    
    // 示例：为联系表单添加提交事件处理
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // 在这里可以添加表单验证和提交逻辑
            alert('感谢您的留言！我会尽快回复。');
            contactForm.reset();
        });
    }
    
    // 可以添加更多功能...
});