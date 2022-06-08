import './styles.css';

const testing = 'potato';
const log = (word: string) => {
	for (let i = 0; i < word.length; i++) {
		console.log(word[i]);
	}
}

log(testing);
