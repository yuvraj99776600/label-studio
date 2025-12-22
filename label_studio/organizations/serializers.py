"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

from drf_dynamic_fields import DynamicFieldsMixin
from organizations.models import Organization, OrganizationMember
from projects.models import Project
from rest_framework import serializers
from tasks.models import Annotation
from users.serializers import UserSerializer


class OrganizationIdSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'title', 'contact_info', 'created_at']


class OrganizationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


# =========================================
# OrganizationMemberListAPI
# OrganizationMemberDetailAPI
# =========================================


class OrganizationMemberListParamsSerializer(serializers.Serializer):
    active = serializers.BooleanField(required=False, default=False)
    contributed_to_projects = serializers.BooleanField(required=False, default=False)


class UserOrganizationMemberSerializer(UserSerializer):
    created_projects = serializers.SerializerMethodField(read_only=True)
    contributed_to_projects = serializers.SerializerMethodField(read_only=True)

    def get_created_projects(self, user):
        if not self.context.get('contributed_to_projects', False):
            return None
        created_projects_map = self.context.get('created_projects_map')
        if created_projects_map is not None:
            return created_projects_map.get(user.id, [])

        organization = self.context.get('request').user.active_organization
        projects = Project.objects.filter(created_by=user, organization=organization).values('id', 'title')
        return [
            {
                'id': project['id'],
                'title': project['title'],
            }
            for project in projects
        ]

    def get_contributed_to_projects(self, user):
        if not self.context.get('contributed_to_projects', False):
            return None
        contributed_to_projects_map = self.context.get('contributed_to_projects_map')
        if contributed_to_projects_map is not None:
            return contributed_to_projects_map.get(user.id, [])

        organization = self.context.get('request').user.active_organization
        org_project_ids = Project.objects.filter(organization=organization).values_list('id', flat=True)
        annotations = (
            Annotation.objects.select_related('project')
            .filter(completed_by=user, project__in=list(org_project_ids))
            .values('project__id', 'project__title')
            .distinct()
        )
        return [
            {
                'id': annotation['project__id'],
                'title': annotation['project__title'],
            }
            for annotation in annotations
        ]

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('created_projects', 'contributed_to_projects')


class OrganizationMemberListSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    user = UserOrganizationMemberSerializer()

    class Meta:
        model = OrganizationMember
        fields = ['id', 'organization', 'user']


class OrganizationMemberSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    annotations_count = serializers.SerializerMethodField(read_only=True)
    contributed_projects_count = serializers.SerializerMethodField(read_only=True)
    user = UserOrganizationMemberSerializer()

    def get_annotations_count(self, member):
        org = self.context.get('organization')
        return member.user.annotations.filter(project__organization=org).count()

    def get_contributed_projects_count(self, member):
        org = self.context.get('organization')
        return member.user.annotations.filter(project__organization=org).values('project').distinct().count()

    class Meta:
        model = OrganizationMember
        fields = ['user', 'organization', 'contributed_projects_count', 'annotations_count', 'created_at']


# =========================================


class OrganizationInviteSerializer(serializers.Serializer):
    token = serializers.CharField(required=False)
    invite_url = serializers.CharField(required=False)
