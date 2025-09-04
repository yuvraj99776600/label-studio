# FSM (Finite State Machine) Framework

A high-performance Django-based finite state machine framework with UUID7 optimization, declarative transitions, and comprehensive state management capabilities.

## Overview

The FSM framework provides:

- **Core Infrastructure**: Abstract base state models and managers
- **UUID7 Optimization**: Time-series optimized state records with natural ordering
- **Declarative Transitions**: Pydantic-based transition system with validation
- **REST API**: Generic endpoints for state management
- **High Performance**: Optimized for high-volume state changes with caching
- **Extensible**: Plugin-based architecture for custom implementations

## Architecture

### Core Components

1. **BaseState**: Abstract model providing UUID7-optimized state tracking
2. **StateManager**: High-performance state management with intelligent caching
3. **Transition System**: Declarative, Pydantic-based transitions with validation
4. **State Registry**: Dynamic registration system for entity states, choices and transitions

## Quick Start

### 1. Define State Choices

```python
from django.db import models
from django.utils.translation import gettext_lazy as _
from fsm.registry import register_state_choices

@register_state_choices('order')
class OrderStateChoices(models.TextChoices):
    CREATED = 'CREATED', _('Created')
    PROCESSING = 'PROCESSING', _('Processing')
    SHIPPED = 'SHIPPED', _('Shipped')
    DELIVERED = 'DELIVERED', _('Delivered')
    CANCELLED = 'CANCELLED', _('Cancelled')
```

### 2. Create State Model with Optional Denormalizer

```python
from fsm.models import BaseState
from fsm.registry import register_state_model

# Optional: Define denormalizer for performance optimization
def denormalize_order(entity):
    """Extract frequently queried fields to avoid JOINs."""
    return {
        'customer_id': entity.customer_id,
        'store_id': entity.store_id,
        'total_amount': entity.total_amount,
    }

@register_state_model('order', denormalizer=denormalize_order)
class OrderState(BaseState):
    # Entity relationship
    order = models.ForeignKey('shop.Order', related_name='fsm_states', on_delete=models.CASCADE)
    
    # Override state field with choices
    state = models.CharField(max_length=50, choices=OrderStateChoices.choices, db_index=True)
    
    # Denormalized fields for performance (automatically populated by denormalizer)
    customer_id = models.PositiveIntegerField(db_index=True)
    store_id = models.PositiveIntegerField(db_index=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        indexes = [
            models.Index(fields=['order_id', '-id'], name='order_current_state_idx'),
        ]
```

### 3. Alternative: Use Built-in State Model Methods

For simpler use cases, state models can define denormalization directly:

```python
class OrderState(BaseState):
    # ... fields ...
    
    @classmethod
    def get_denormalized_fields(cls, entity):
        """Built-in method for denormalization without registry."""
        return {
            'customer_id': entity.customer_id,
            'store_id': entity.store_id,
        }
```

### 4. Define Transitions

```python
from fsm.transitions import BaseTransition
from fsm.registry import register_state_transition
from pydantic import Field

@register_state_transition('order', 'process_order')
class ProcessOrderTransition(BaseTransition):
    processor_id: int = Field(..., description="ID of user processing the order")
    priority: str = Field('normal', description="Processing priority")
    
    @property
    def target_state(self) -> str:
        return OrderStateChoices.PROCESSING
    
    def validate_transition(self, context) -> bool:
        return context.current_state == OrderStateChoices.CREATED
        
    def transition(self, context) -> dict:
        return {
            "processor_id": self.processor_id,
            "priority": self.priority,
            "processed_at": context.timestamp.isoformat()
        }
```

### 5. Execute Transitions

```python
from fsm.state_manager import StateManager

# Execute transition - this is the only way to execute transitions
result = StateManager.execute_transition(
    entity=order,
    transition_name='process_order',
    transition_data={'processor_id': 123, 'priority': 'high'},
    user=request.user
)
```

### 6. Query States

```python
from fsm.state_manager import get_state_manager

StateManager = get_state_manager()

# Get current state
current_state = StateManager.get_current_state(order)

# Get state history
history = StateManager.get_state_history(order, limit=10)
```

## Key Features

### Denormalization for Performance

- **Avoid JOINs**: Copy frequently queried fields to state records
- **Registry-based**: Register denormalizers with state models
- **Automatic**: Fields are populated during state transitions
- **Flexible**: Use registry decorator or built-in class method

```python
# Using registry decorator
@register_state_model('task', denormalizer=lambda t: {'project_id': t.project_id})
class TaskState(BaseState):
    project_id = models.IntegerField(db_index=True)
    # ...

# Using built-in method
class TaskState(BaseState):
    @classmethod
    def get_denormalized_fields(cls, entity):
        return {'project_id': entity.project_id}
```

### UUID7 Performance Optimization

- **Natural Time Ordering**: UUID7 provides chronological ordering without separate timestamp indexes
- **High Concurrency**: INSERT-only approach eliminates locking contention
- **Scalability**: Supports large amounts of state records with consistent performance

### Declarative Transitions

- **Pydantic Validation**: Strong typing and automatic validation
- **Composable Logic**: Reusable transition classes with inheritance
- **Hooks System**: Pre/post transition hooks for custom logic

### Advanced State Manager Features

```python
# Time-range queries using UUID7
from datetime import datetime, timedelta
recent_states = StateManager.get_states_since(
    entity=order, 
    since=datetime.now() - timedelta(hours=24)
)

# Get current state object (not just string)
current_state_obj = StateManager.get_current_state_object(order)
if current_state_obj:
    print(f"State: {current_state_obj.state}")
    print(f"Since: {current_state_obj.created_at}")
    print(f"By: {current_state_obj.triggered_by}")

# Get state history with full objects
history = StateManager.get_state_history(order, limit=10)
for state in history:
    print(f"{state.state} at {state.created_at}")

# Cache management
StateManager.invalidate_cache(order)  # Clear cache for entity
StateManager.warm_cache([order1, order2, order3])  # Pre-populate cache
```

### Registry System

The FSM uses a flexible registry pattern for decoupling:

```python
from fsm.registry import (
    state_model_registry,
    state_choices_registry,
    transition_registry,
    register_state_model,
    register_state_choices,
    register_state_transition,
)

# Register state choices
@register_state_choices('task')
class TaskStateChoices(models.TextChoices):
    # ...

# Register state model with denormalizer
@register_state_model('task', denormalizer=denormalize_task)
class TaskState(BaseState):
    # ...

# Register transitions
@register_state_transition('task', 'start_task')
class StartTaskTransition(BaseTransition):
    # ...

# Access registries directly
model = state_model_registry.get_model('task')
choices = state_choices_registry.get_choices('task')
transition = transition_registry.get_transition('task', 'start_task')
```

## Performance Characteristics

- **State Queries**: O(1) current state lookup via UUID7 ordering
- **History Queries**: Optimal for time-series access patterns
- **Bulk Operations**: Efficient batch processing for thousands of entities
- **Cache Integration**: Intelligent caching with automatic invalidation
- **Memory Efficiency**: Minimal memory footprint for state objects

## Transition System Features

### Transition Context

```python
from fsm.transitions import TransitionContext

# Context provides rich information during transitions
context = TransitionContext(
    entity=task,
    current_user=user,
    current_state='CREATED',
    target_state='IN_PROGRESS',
    organization_id=org_id,
    metadata={'source': 'api', 'priority': 'high'}
)

# Context properties
if context.is_initial_transition:
    # First state for this entity
    pass
if context.has_current_state:
    # Entity has existing state
    pass
```

### Transition Utilities

```python
from fsm.state_manager import StateManager
from fsm.transition_utils import (
    get_available_transitions,
    get_transition_schema,
    validate_transition_data,
)

# Execute a transition - the only way to execute transitions
result = StateManager.execute_transition(
    entity=task,
    transition_name='start_task',
    transition_data={'assigned_user_id': 123},
    user=request.user
)

# Get available transitions for an entity
available = get_available_transitions(task)

# Get JSON schema for transition (useful for APIs)
schema = get_transition_schema(StartTaskTransition)

# Validate transition data before execution
errors = validate_transition_data(StartTaskTransition, data)
```

## Extension Points

### Custom State Manager

```python
from fsm.state_manager import BaseStateManager

class CustomStateManager(BaseStateManager):
    def get_current_state(self, entity):
        # Custom logic
        return super().get_current_state(entity)
```

### Custom Validation

```python
@register_state_transition('order', 'validate_payment')  
class PaymentValidationTransition(BaseTransition):
    def validate_transition(self, context) -> bool:
        # Custom business logic
        return self.check_payment_method(context.entity)
```

## Framework vs Implementation

This is the **core framework** - a clean, generic FSM system. Product-specific implementations (state definitions, concrete models, business logic) should be in separate branches/modules for:

- **Clean Architecture**: Framework logic separated from business logic
- **Reusability**: Framework can be used across different projects
- **Maintainability**: Changes to business logic don't affect framework
- **Review Process**: Framework and implementation can be reviewed independently

## Migration from Other FSM Libraries

The framework provides migration utilities and is designed to be compatible with existing Django FSM patterns while offering significant performance improvements through UUID7 optimization.

## Contributing

When contributing:
- Keep framework code generic and reusable
- Add product-specific code to appropriate implementation branches
- Include performance tests for UUID7 optimizations
- Document extension points and customization options
