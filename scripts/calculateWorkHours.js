const simpleGit = require('simple-git');
const git = simpleGit();

async function calculateWorkHours() {
    try {
        // Get the commit log
        const log = await git.log();
        const commits = log.all;

        if (commits.length === 0) {
            console.log('No commits found in this repository.');
            return;
        }

        let totalWorkTime = 0;
        let currentCommit = commits[0];
        const maxInterval = 3 * (60 * 60 * 1000);

        for (let i = 1; i < commits.length; i++) {
            const nextCommit = commits[i];
            const currentCommitTime = new Date(currentCommit.date).getTime();
            const nextCommitTime = new Date(nextCommit.date).getTime();

            if ((currentCommitTime - nextCommitTime) > maxInterval) {
                totalWorkTime += currentCommitTime - new Date(commits[i - 1].date).getTime();
                currentCommit = nextCommit;
            }
        }

        // Add the time from the last relevant commit to the end of the log
        totalWorkTime += new Date(currentCommit.date).getTime() - new Date(commits[commits.length - 1].date).getTime();

        // Convert milliseconds to hours
        const totalWorkHours = totalWorkTime / (1000 * 60 * 60);

        // Calculate the number of days from the first commit to the last commit
        const firstCommitTime = new Date(commits[commits.length - 1].date).getTime();
        const lastCommitTime = new Date(commits[0].date).getTime();
        const totalDays = (lastCommitTime - firstCommitTime) / (1000 * 60 * 60 * 24);

        // Calculate average hours per day
        const averageHoursPerDay = totalWorkHours / totalDays;

        console.log(`Total work hours: ${totalWorkHours.toFixed(2)} hours`);
        console.log(`Average hours per day: ${averageHoursPerDay.toFixed(2)} hours`);
    } catch (error) {
        console.error('Error calculating work hours:', error);
    }
}

calculateWorkHours();
