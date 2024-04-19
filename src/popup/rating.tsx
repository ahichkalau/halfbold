// RatingPrompt.js
import React, { useEffect, useState } from 'react';

import './../styles/rating.css';

function RatingPrompt({ onClose }) {
	const [hasRated, setHasRated] = useState(false);
	const [hovered, setHovered] = useState(null);

	useEffect(() => {
		const rating = localStorage.getItem('userRating');
		if (rating) {
			setHasRated(true);
		}
	}, []);

	const handleStarClick = (rate) => {
		localStorage.setItem('userRating', rate);
		setHasRated(true);
		const urls = [
			'https://forms.gle/52iahYwopDuiAHQC7',
			'https://forms.gle/52iahYwopDuiAHQC7',
			'https://forms.gle/52iahYwopDuiAHQC7',
			'https://chromewebstore.google.com/detail/multiple-url-opener/jfanmjbbnmijbkhgnkpbaclkfeliinob/reviews',
			'https://chromewebstore.google.com/detail/multiple-url-opener/jfanmjbbnmijbkhgnkpbaclkfeliinob/reviews',
		];
		window.open(urls[rate - 1], '_blank');
		onClose(); // Закрываем компонент RatingPrompt
		// Ваша логика для отправки рейтинга или что-то еще
	};

	return (
		<>
			{!hasRated && (
				<div className="rating-wrapper">
					<p className="rate_us">Rate us, please</p>
					<div className="star-rating-container">
						{Array.from({ length: 5 }, (_, index) => (
							<span
								className={`star${hovered !== null && index < hovered ? ' highlighted' : ''}`}
								key={index}
								onClick={() => handleStarClick(index + 1)}
								onMouseEnter={() => setHovered(index + 1)}
								onMouseLeave={() => setHovered(null)}>
								★
							</span>
						))}
					</div>
				</div>
			)}
		</>
	);
}

export default RatingPrompt;
