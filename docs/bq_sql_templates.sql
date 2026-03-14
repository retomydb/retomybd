-- BigQuery SQL templates for selecting candidate model repos

-- 1) By repository name keywords
SELECT repo_name.owner AS owner, repo_name.repo AS repo, repo_name.repo_name AS full_name
FROM `bigquery-public-data.github_repos.sample_repos`
WHERE LOWER(repo_name.repo_name) LIKE '%model%' OR LOWER(repo_name.repo_name) LIKE '%transformer%' OR LOWER(repo_name.repo_name) LIKE '%llama%'
LIMIT 10000;

-- 2) By README content (requires a table with README text available)
-- Replace `your_project.your_dataset.repo_readmes` with an actual table that contains readme_text
SELECT owner, repo, full_name
FROM `your_project.your_dataset.repo_readmes`
WHERE LOWER(readme_text) LIKE '%huggingface%' OR LOWER(readme_text) LIKE '%transformers%' OR LOWER(readme_text) LIKE '%pipeline%'
LIMIT 10000;

-- 3) By presence of common model files (if file listing table available)
-- Example: select repos that include 'model' file or 'README.md'
SELECT DISTINCT repo_owner AS owner, repo_name AS repo, CONCAT(repo_owner, '/', repo_name) AS full_name
FROM `your_project.your_dataset.repo_files`
WHERE LOWER(file_path) LIKE '%README.md' OR LOWER(file_path) LIKE '%model%'
LIMIT 10000;

-- 4) By stars + language
SELECT repo_name.owner AS owner, repo_name.repo AS repo, repo_name.repo_name AS full_name
FROM `bigquery-public-data.github_repos.sample_repos`
WHERE stargazers_count > 50 AND LOWER(language) IN ('python','jupyter','jupyter notebook','jupyter-notebook')
LIMIT 10000;
