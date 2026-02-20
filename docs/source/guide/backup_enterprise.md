---
title: Create backups for on-prem MLTL Annotate
short: Back up MLTL Annotate
tier: enterprise
type: guide
order: 0
order_enterprise: 78
meta_title: Back up MLTL Annotate on-prem
meta_description: How to back up your on-prem MLTL Annotate environment
section: "Install"
parent_enterprise: "install_enterprise"
date: 2024-01-22 15:54:30
---

Backing up your MLTL Annotate on-prem installation involves more than just a database backup, although that is a critical component. Here's an overview of the steps you should take to back up your MLTL Annotate on-premises installation:

1. **Back up your databases (development and production).** This is essential as it contains all your project data and configurations. If you're using PostgreSQL, you can use tools like **pg_dump** to create backups of your databases.
   
2. **Back up your file storage.** If you're using local file storage or have files stored in a cloud storage that's synced with MLTL Annotate, ensure you back up these files. This includes any media files (images, audio, video) that you've uploaded for labeling.

3. **Back up your configuration files that have environment variables.** This includes your `label-studio` configuration file (which might contain your database connection settings and other configurations) and any custom scripts or machine learning models that you've integrated with MLTL Annotate.

4. **Back up your environment variables.** If you're using environment variables to configure MLTL Annotate (which might include database credentials, secret keys, etc.), make sure to back these up as well.

5. **Back up your Docker volumes.** If you're running MLTL Annotate in Docker containers and you have data volumes, back up these volumes. Docker volumes may contain your database data, media uploads, and other persistent data.

6. **Document your current setup.** Make sure to document the versions of MLTL Annotate and any other dependencies you're using, as well as any specific configurations or customizations you've made. This will be helpful if you need to restore from a backup.

7. **Regularly test your backups.** Ensure that your backup process is working by regularly testing that you can restore your MLTL Annotate instance from the backups.


Remember to store your backups in a secure location, ideally in a different physical location than your production environment to protect against site-wide issues such as natural disasters or power outages. It's also a good practice to encrypt sensitive data in your backups to prevent unauthorized access.
