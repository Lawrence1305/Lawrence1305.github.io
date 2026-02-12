// 等待DOM完全加载
document.addEventListener('DOMContentLoaded', function() {
    console.log('网站已加载');
    
    // 添加数学公式的动画效果
    const formulas = document.querySelectorAll('.formula');
    if (formulas.length > 0) {
        formulas.forEach(formula => {
            formula.addEventListener('mouseenter', function() {
                this.style.transition = 'transform 0.3s';
                this.style.transform = 'scale(1.2)';
                this.style.color = '#e74c3c'; // 使用强调色
            });
            
            formula.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.color = '';
            });
        });
    }
    
    // 为联系表单添加提交事件处理
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // 在这里可以添加表单验证和提交逻辑
            alert('感谢您的留言！我会尽快回复。');
            contactForm.reset();
        });
    }
    
    // 添加平滑滚动效果
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
});