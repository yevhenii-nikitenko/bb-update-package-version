const { Bitbucket } = require('bitbucket');
require('dotenv').config();

const main = async ({ name, version }, { token, repo_slug, workspace, mainBranch }) => {
    try {
        if (!name || !version) throw new Error('no name:version pair provided');

        const fileName = 'package.json';
        const bitbucket = new Bitbucket({
            auth: {
                token
            },
        });

        const root = await bitbucket.repositories.readSrcRoot({ repo_slug, workspace });
        const file = root.data.values.find(f => f.path === fileName);

        // maybe package.json is not in the root
        // possible feature - look through the project to find it;
        if (!file) throw new Error('package.json is not found');

        const content = await bitbucket.source.read({ commit: file.commit.hash, path: file.path, repo_slug, workspace });
        const parsedFile = JSON.parse(content.data);

        if (!parsedFile.dependencies[name] && !parsedFile.devDependencies[name]) {
            throw new Error(`no ${name} dependency found`);
        }

        // are both updates required?
        // update dependencies version
        if (parsedFile.dependencies[name]) {
            parsedFile.dependencies[name] = version;
        }

        // update devDependencies version
        if (parsedFile.devDependencies[name]) {
            parsedFile.devDependencies[name] = version;
        }

        const sourceBranch = `update/${name}/${version}`;

        await bitbucket.repositories.createSrcFileCommit({
            _body: {
                [fileName]: JSON.stringify(parsedFile, null, 4),
                branch: sourceBranch,
                message: `update ${name} package version to ${version}`,

            }, repo_slug, workspace
        });

        // 4 requests are made, maybe is it possible to reduce the number of calls?
        await bitbucket.repositories.createPullRequest({
            _body: {
                title: `${fileName} update`,
                source: {
                    branch: {
                        name: sourceBranch
                    }
                },
                destination: {
                    branch: {
                        name: mainBranch
                    }
                }
            }, repo_slug, workspace
        });

        console.log('DONE');
    } catch (err) {
        // any error handling
        console.error(err);
    }
}

const args = process.argv.slice(2);

main({
    name: args[0],
    version: args[1]
}, {
    token: process.env.BITBUCKET_TOKEN,
    repo_slug: process.env.REPO_SLUG,
    workspace: process.env.WORKSPACE,
    mainBranch: process.env.SOURCE_BRANCH
})