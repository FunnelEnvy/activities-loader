import './styles.css';

const testing: string = 'potato';
const log = (word: string) => {
	for (let i = 0; i < word.length; i++) {
		console.log(word[i]);
	}
}

log(testing);
