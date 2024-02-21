import github from '@actions/github';

async function main() {
	const { payload, repo } = github.context;
	const { pull_request } = payload;

	const octokit = new github.getOctokit(process.env.GITHUB_TOKEN);

	// Check if a comment already exists
	const { data: comments } = await octokit.issues.listComments({
		...repo,
		issue_number: pull_request.number
	});

	const commentBody = `Altered directories: ${process.argv[2]}`;

	// Check if a comment from the bot exists
	const existingComment = comments.find(comment => comment.user.login === 'github-actions[bot]' && comment.body.startsWith('Altered directories:'));

	if (existingComment) {
		// Edit the existing comment
		await octokit.issues.updateComment({
			...repo,
			comment_id: existingComment.id,
			body: commentBody
		});
	} else {
		// Leave a new comment
		await octokit.issues.createComment({
			...repo,
			issue_number: pull_request.number,
			body: commentBody
		});
	}
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
