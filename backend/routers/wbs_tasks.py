from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict

from database import get_db
from models import WBSTaskDB, WBSTaskCreate, WBSTaskUpdate, WBSTaskResponse, ProjectDB

router = APIRouter(
    prefix="/wbs-tasks",
    tags=["WBS Tasks"],
)

# Helper function to build task tree
def build_tree(tasks: List[WBSTaskDB]) -> List[WBSTaskResponse]:
    task_map: Dict[int, WBSTaskResponse] = {}
    root_tasks: List[WBSTaskResponse] = []

    # Initialize all tasks in the map
    for task in tasks:
        task_map[task.id] = WBSTaskResponse(
            id=task.id,
            text=task.text,
            start_date=task.start_date,
            end_date=task.end_date,
            progress=task.progress,
            deliverables=task.deliverables,
            remarks=task.remarks,
            parent_id=task.parent_id,
            project_id=task.project_id,
            sort_order=task.sort_order,
            children=[]
        )

    # Build the tree structure
    for task_id, task_node in task_map.items():
        if task_node.parent_id and task_node.parent_id in task_map:
            parent_node = task_map[task_node.parent_id]
            parent_node.children.append(task_node)
        else:
            root_tasks.append(task_node)
            
    # Sort children by sort_order
    for task_node in task_map.values():
        task_node.children.sort(key=lambda x: x.sort_order)
        
    # Sort root tasks
    root_tasks.sort(key=lambda x: x.sort_order)

    return root_tasks

@router.get("/{project_id}", response_model=List[WBSTaskResponse])
def get_wbs_tasks_for_project(project_id: int, db: Session = Depends(get_db)):
    """특정 프로젝트의 모든 WBS 태스크를 계층 구조로 조회합니다."""
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    tasks = db.query(WBSTaskDB).filter(WBSTaskDB.project_id == project_id).order_by(WBSTaskDB.sort_order).all()
    
    if not tasks:
        return []
        
    tree = build_tree(tasks)
    return tree

@router.post("/", response_model=WBSTaskResponse)
def create_wbs_task(task: WBSTaskCreate, db: Session = Depends(get_db)):
    """새로운 WBS 태스크를 생성합니다."""
    # Project exists check
    project = db.query(ProjectDB).filter(ProjectDB.id == task.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with id {task.project_id} not found")

    # Parent task exists check
    if task.parent_id:
        parent_task = db.query(WBSTaskDB).filter(WBSTaskDB.id == task.parent_id).first()
        if not parent_task:
            raise HTTPException(status_code=404, detail=f"Parent task with id {task.parent_id} not found")

    db_task = WBSTaskDB(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return WBSTaskResponse.model_validate(db_task)

@router.put("/{task_id}", response_model=WBSTaskResponse)
def update_wbs_task(task_id: int, task_update: WBSTaskUpdate, db: Session = Depends(get_db)):
    """WBS 태스크를 수정합니다."""
    db_task = db.query(WBSTaskDB).filter(WBSTaskDB.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")

    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return WBSTaskResponse.model_validate(db_task)

@router.delete("/{task_id}")
def delete_wbs_task(task_id: int, db: Session = Depends(get_db)):
    """WBS 태스크를 삭제합니다. 하위 태스크도 함께 삭제됩니다."""
    db_task = db.query(WBSTaskDB).filter(WBSTaskDB.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")

    # The relationship cascade setting handles deletion of children.
    db.delete(db_task)
    db.commit()
    return {"message": f"Task {task_id} and all its sub-tasks have been deleted."}
