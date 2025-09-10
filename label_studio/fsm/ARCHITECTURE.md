# FSM Architecture - Import Dependencies

## Overview
The FSM module has been refactored to eliminate ALL circular import dependencies and function-level imports while maintaining a clean, robust architecture with StateManager as the main entry point for enterprise extensibility.

## Module Dependency Graph

```
┌─────────────────────┐
│     models.py       │
│  (BaseState class)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    registry.py      │
│ (Registries for     │
│  states/transitions)│
└──────────┬──────────┘
           │
           ├──────────────────┐
           ▼                  ▼
┌─────────────────────┐  ┌─────────────────────┐
│   transitions.py    │  │transition_executor.py│
│ (BaseTransition)    │  │ (Orchestrator)      │
└─────────────────────┘  └─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  state_manager.py   │
                         │ (Main Entry Point)  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ transition_utils.py │
                         │ (Convenience layer) │
                         └─────────────────────┘
```

## Key Design Decisions

### 1. Separation of Concerns
- **models.py**: Base state model and utilities
- **registry.py**: Pure storage and retrieval of transitions and state models (no execution logic)
- **transitions.py**: Defines transition base class and validation logic (no state management)
- **transition_executor.py**: Orchestrator that coordinates between transitions and state manager
- **state_manager.py**: Main entry point with execute_transition method (enterprise extensible)
- **transition_utils.py**: Convenience functions and re-exports for public API

### 2. Import Strategy
- **NO function-level imports** anywhere in the codebase
- Module-level imports follow strict hierarchy (no cycles)
- `state_manager.py` imports from `transition_executor.py` and provides the main entry point
- `transition_executor.py` does NOT import StateManager - receives it as parameter
- `TYPE_CHECKING` imports used only for type hints (don't execute at runtime)

### 3. Execution Flow
1. **Enterprise Entry Point**: `StateManager.execute_transition()` 
   - This is the main method that enterprise implementations override
   - Also available via `transition_utils.execute_transition()` (convenience re-export)
2. StateManager delegates to TransitionExecutor:
   - Calls `execute_transition_with_state_manager()` passing itself as parameter
   - This avoids circular imports while maintaining enterprise extensibility
3. TransitionExecutor orchestrates:
   - Gets transition class from registry
   - Gets current state from state model  
   - Creates transition instance and context
   - Calls `transition.prepare_and_validate()`
   - Uses passed StateManager methods to create the state record
   - Calls `transition.finalize()`
4. Returns the new state record

### 4. Benefits
- **Zero circular dependencies**: Clean, unidirectional import hierarchy
- **No function-level imports**: All imports at module level for clarity
- **Testability**: Each module can be tested independently
- **Extensibility**: New transitions can be registered without modifying core code
- **Clarity**: Clear separation between registration, execution, and state management
- **Performance**: No import overhead from function-level imports

## Import Rules

1. **StateManager is the main entry point** - Enterprise implementations should extend StateManager.execute_transition()
2. **transition_executor.py takes StateManager as parameter** - avoids circular imports while allowing orchestration
3. **Use TYPE_CHECKING imports** for type hints to avoid runtime dependencies  
4. **transition_utils.py provides convenience API** using `get_state_manager()` to respect overrides

## Module Responsibilities

### models.py
- Defines `BaseState` abstract model
- Provides UUID7 utilities
- No dependencies on other FSM modules

### registry.py
- Manages registries for state models and transitions
- Provides decorators for registration
- Depends only on models.py (via TYPE_CHECKING)

### transitions.py
- Defines `BaseTransition` abstract class
- Provides `TransitionContext` for passing data
- Handles validation via `prepare_and_validate()`
- Post-processing via `finalize()`
- Depends only on models.py (via TYPE_CHECKING)

### transition_executor.py
- Orchestrator for transition execution logic
- Takes StateManager as parameter to avoid circular imports
- Coordinates the full transition workflow
- Does NOT import StateManager directly

### state_manager.py
- **Main entry point with `execute_transition()` method**
- **Enterprise implementations override this for additional behavior**
- Handles state persistence via `transition_state()`
- Manages state caching and provides state query methods  
- Depends on models.py, registry.py, and transition_executor.py

### transition_utils.py
- Provides convenience functions for common operations
- Uses `get_state_manager()` to respect enterprise StateManager overrides
- Helper functions for transition discovery and validation

## Testing
All tests pass with the new architecture, confirming:
- No circular import issues
- No function-level imports required
- StateManager as extensible main entry point
- Backward compatibility maintained
- All functionality preserved

## Enterprise Usage

Enterprise implementations can now safely extend StateManager:

```python
class EnterpriseStateManager(StateManager):
    @classmethod
    def execute_transition(cls, entity, transition_name, **kwargs):
        # Add enterprise-specific pre-processing
        cls.log_enterprise_audit(entity, transition_name)
        
        # Call parent implementation
        result = super().execute_transition(entity, transition_name, **kwargs)
        
        # Add enterprise-specific post-processing  
        cls.notify_enterprise_systems(result)
        
        return result
```

The architecture ensures that all transition logic flows through the StateManager, making it the perfect extension point for additional enterprise behavior.

**Important**: The `transition_utils.execute_transition()` function uses `get_state_manager()` to dynamically get the potentially overridden StateManager class, ensuring that enterprise implementations are properly respected even when called through the convenience API.