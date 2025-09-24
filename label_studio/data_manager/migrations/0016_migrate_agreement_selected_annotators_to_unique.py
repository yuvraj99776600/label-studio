from django.db import migrations
from django.apps import apps as django_apps
from core.models import AsyncMigrationStatus
from core.redis import start_job_async_or_sync

migration_name = '0016_migrate_agreement_selected_annotators_to_unique'


def forward_migration():
    migration, created = AsyncMigrationStatus.objects.get_or_create(
        name=migration_name,
        defaults={'status': AsyncMigrationStatus.STATUS_STARTED}
    )
    if not created:
        return  # already in progress or done

    # Look up models at runtime inside the worker process
    View = django_apps.get_model('data_manager', 'View')
    Annotation = django_apps.get_model('tasks', 'Annotation')

    # Cache unique annotators per project_id to avoid repetitive queries
    project_to_unique_annotators = {}

    # Iterate using values() to avoid loading full model instances
    # Fetch only the fields we need
    qs = View.objects.all().values('id', 'project_id', 'data')

    updated = 0
    for row in qs.iterator(chunk_size=1000):
        view_id = row['id']
        project_id = row['project_id']
        data = row.get('data') or {}

        agreement = data.get('agreement_selected')
        if not isinstance(agreement, dict):
            continue

        # Only migrate views that actually have annotators key present
        existing_annotators = agreement.get('annotators', None)
        if existing_annotators is None:
            continue

        # Compute unique annotators for this project (once per project)
        if project_id not in project_to_unique_annotators:
            unique_ids = list(
                Annotation.objects
                .filter(project_id=project_id, completed_by_id__isnull=False)
                .values_list('completed_by_id', flat=True)
                .distinct()
            )
            # Normalize to unique ints
            unique_ids = {int(u) for u in unique_ids}
            project_to_unique_annotators[project_id] = unique_ids

        new_annotators = project_to_unique_annotators[project_id]

        # If no change, skip update
        old_set = {int(a) for a in (existing_annotators or [])}
        if set(new_annotators) == old_set:
            continue

        # Prepare new data JSON
        new_data = dict(data)
        new_agreement = dict(agreement)
        new_agreement['annotators'] = list(new_annotators)
        new_data['agreement_selected'] = new_agreement

        # Update only the JSON field via update(); do not load model instance or call save()
        View.objects.filter(id=view_id).update(data=new_data)
        updated += 1

    if updated:
        print(f'{migration_name} Updated {updated} View rows')
    
    migration.status = AsyncMigrationStatus.STATUS_FINISHED
    migration.save(update_fields=['status'])

def forwards(apps, schema_editor):
    start_job_async_or_sync(forward_migration)


def backwards(apps, schema_editor):
    # Irreversible: we cannot reconstruct the previous annotator lists safely
    pass


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('data_manager', '0015_alter_view_options')
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]


