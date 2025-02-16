import React from 'react';
import { DropResult } from 'react-beautiful-dnd';
import { Semester, Course, SEMESTER_CODE_MAPPINGS } from '../../common/data';
import { v4 as uuid } from 'uuid';
import { getRecentSemesterMetadata, getUpdatedSemesterData, reorderList } from '../plannerUtils';

/**
 * A hook that manages the state of the degree planner component.
 *
 * @param items Array of semesters obtained from the user plan
 * @param onPersistChanges Function that saves the planner state across sessions (currently localStorage)
 *
 * @returns 'plans' which holds the planner state, as well as multiple utility functions
 * Information about each function is documented inside the hook.
 */
export function usePlannerContainer(
  onPersistChanges: (data: { semesters: Record<string, Semester> }) => void,
  getResults: () => any[],
) {
  // Object mapping semester code to each semester
  // Used to maange state of the degree planner
  // Warning: Do NOT use lists to get user semesters; use semesters instead
  const [lists, setLists] = React.useState<{
    semesters: Record<string, Semester>;
  }>({ semesters: {} });

  // Array of semesters (use this whenever you need to get user semesters)
  const semesters = Object.entries(lists.semesters).map(([_, semester]) => semester);

  // Controls whether or not to persist changes
  const [persist, setPersist] = React.useState<boolean>(false);

  // Array of courses that the user plans on adding
  const [coursesToAdd, setCoursesToAdd] = React.useState<Course[]>([]);

  // Controls whether or not to show Droppable for adding courses
  const [showAddCourseDroppable, setShowAddCourseDroppable] = React.useState(false);

  /**
   * Runs whenever an event to add courses to the planner is called
   *
   * @param CoursesToAdd Array of courses that the user wants to add
   *
   * Note: changes are NOT persisted until {@link coursesAddedHandler} is called
   */
  const coursesToAddHandler = (CoursesToAdd: Course[]) => {
    setCoursesToAdd(CoursesToAdd);
    setShowAddCourseDroppable(true);
    setPersist(false);
  };

  /**
   * Runs whenver an event to finish adding courses to the planner is called
   */
  const coursesAddedHandler = () => {
    setCoursesToAdd([]);
    setShowAddCourseDroppable(false);
    setPersist(true);
  };

  /**
   * Allows users to add an additional semester to their schedule
   */
  const addSemester = () => {
    const recentSemester = getRecentSemesterMetadata(semesters);
    const { year, semester } = getUpdatedSemesterData(recentSemester);

    const newSemester: Semester = {
      title: `${SEMESTER_CODE_MAPPINGS[semester]} ${year}`,
      code: (year + semester.toString()).toString(),
      courses: [],
    };
    updateSemesters([...semesters, newSemester]);
  };

  /**
   * Allows users to remove a semester from their schedule
   * Does not run if the user only has one semester
   */
  const removeSemester = () => {
    if (semesters.length > 1) {
      updateSemesters(semesters.slice(0, semesters.length - 1));
    }
  };

  /**
   * Not used; {@link coursesToAddHandler} and {@link coursesAddedHandler}
   * have implemented the functionality of this function
   */
  const addItemToList = (sourceIndex: number, destinationId: string, destinationIndex: number) => {
    const semesters = lists.semesters;
    const results = getResults();
    const course = JSON.parse(JSON.stringify(results[sourceIndex]));
    course.id = uuid();

    // Update the destination semester's courses
    const newSemesters = lists.semesters;
    const clonedDestination = Array.from(newSemesters[destinationId].courses);
    clonedDestination.splice(destinationIndex, 0, course);
    newSemesters[destinationId] = {
      ...newSemesters[destinationId],
      courses: clonedDestination,
    };
    setLists({ semesters: newSemesters });
  };

  /**
   * Allows users to remove courses from their schedule
   * @param itemId
   * @param listId
   */
  const removeItemFromList = (itemId: string, droppableId: string) => {
    const newSemesters = JSON.parse(JSON.stringify(lists.semesters));
    const semester = newSemesters[droppableId];
    const courseIndex = semester.courses.findIndex(({ id }) => id === itemId);
    semester.courses.splice(courseIndex, 1);
    newSemesters[droppableId] = semester;

    setLists({
      semesters: newSemesters,
    });
  };

  /**
   * Updates courses inside a semester after a drag and drop event is called
   * Is called only when a course's starting and ending position is the same semester
   * @param sourceSemester original semester
   * @param sourceIndex original index of course
   * @param destinationIndex final index of course
   * @param sourceId semester Droppable id
   */
  const updateSemester = (
    sourceSemester: Semester,
    sourceIndex: number,
    destinationIndex: number,
    sourceId: string,
  ) => {
    const items = reorderList<Course>(sourceSemester.courses, sourceIndex, destinationIndex);
    const newSemesters = lists.semesters;
    newSemesters[sourceId] = {
      ...sourceSemester,
      courses: items,
    };
    setLists({
      semesters: newSemesters,
    });
  };

  /**
   * Moves an item between lists.
   *
   * @param itemId The ID of the item to move
   * @param startListId The source of the item
   * @param endListId The destination for the item
   */
  const moveItem = (
    sourceSemester: Semester,
    destinationSemester: Semester,
    sourceIndex: number,
    destinationIndex: number,
    sourceId: string,
    destinationId: string,
  ) => {
    const clonedSource = Array.from(sourceSemester.courses);
    const clonedDestination = Array.from(destinationSemester.courses);
    const [removed] = clonedSource.splice(sourceIndex, 1);

    // Move the course to the destination list
    clonedDestination.splice(destinationIndex, 0, removed);

    const newSemesters = lists.semesters;

    // Update the source semester's courses
    newSemesters[sourceId] = {
      ...sourceSemester,
      courses: clonedSource,
    };

    // Update the destination semester's courses
    newSemesters[destinationId] = {
      ...destinationSemester,
      courses: clonedDestination,
    };

    setLists({
      semesters: newSemesters,
    });
  };

  /**
   * Called on the end of each drag and drop event
   * @param param0
   * @returns
   */
  const handleOnDragEnd = ({ source, destination }: DropResult) => {
    if (destination) {
      const sourceId = source.droppableId;
      const destinationId = destination.droppableId;
      const sourceIndex = source.index;
      const destinationIndex = destination.index;

      // Check if item is dragged from CourseSelector
      if (source.droppableId === 'selector') {
        addItemToList(source.index, destinationId, destinationIndex);
        return;
      }
      // Check if item has same starting & ending location
      if (sourceId === destinationId && destinationIndex === sourceIndex) {
        return;
      }

      const sourceSemester = lists.semesters[sourceId];
      const destinationSemester = lists.semesters[destinationId];
      // Check if item has same start & ending container
      if (sourceId === destinationId) {
        updateSemester(sourceSemester, sourceIndex, destinationIndex, sourceId);
      } else {
        // Item has different starting & ending containers
        moveItem(
          sourceSemester,
          destinationSemester,
          sourceIndex,
          destinationIndex,
          sourceSemester.code,
          destinationSemester.code,
        );
      }
    }
  };
  /**
   * Reinitialize the semesters using the given list.
   * Note: Only call this when using Semester[].
   * If using <string, Semester> use setLists
   */
  const updateSemesters = (newSemesters: Semester[]) => {
    setLists({
      semesters: newSemesters.reduce((acc, semester) => {
        acc[semester.code] = semester;
        return acc;
      }, {}),
    });
  };

  // Ensures that planner updates after "DONE" is selected
  React.useEffect(() => {
    if (persist) {
      onPersistChanges(lists);
    }
  }, [lists]);

  return {
    addSemester,
    removeSemester,
    addItemToList,
    updateSemesters,
    removeItemFromList,
    moveItem,
    handleOnDragEnd,
    setPersist,
    coursesToAddHandler,
    coursesAddedHandler,
    showAddCourseDroppable,
    semesters,
    lists,
  };
}
