<template>
  <div class="dashboard-container">
    <header class="header">
      <h1 class="header-title">PCoin Admin Dashboard</h1>
      <button @click="logout" class="btn btn-primary">
        Logout
      </button>
    </header>
    <div class="dashboard-content">
      <div class="dashboard-layout">
        <nav class="sidebar">
          <ul class="nav-menu">
            <li>
              <button @click="activeTab = 'users'" class="nav-item" :class="{ 'active': activeTab === 'users' }">
                User Management
              </button>
            </li>
            <li>
              <button @click="activeTab = 'courses'" class="nav-item" :class="{ 'active': activeTab === 'courses' }">
                Course Management
              </button>
            </li>
            <li>
              <button @click="activeTab = 'assign'" class="nav-item" :class="{ 'active': activeTab === 'assign' }">
                Assign Courses
              </button>
            </li>
            <li>
              <button @click="activeTab = 'analytics'" class="nav-item"
                :class="{ 'active': activeTab === 'analytics' }">
                Quiz Analytics
              </button>
            </li>
            <li>
              <router-link to="/token" class="nav-item" active-class="active">
                Token Management
              </router-link>
            </li>
          </ul>
        </nav>
        <div class="main-content">
          <!-- Users Tab -->
          <div v-if="activeTab === 'users'">
            <div class="section-header">
              <h2 class="section-title">User Management</h2>
              <button @click="reloadUsers" class="btn btn-primary">
                Reload Users
              </button>
            </div>
            <div class="search-container">
              <input type="text" v-model="userSearchTerm" placeholder="Search users..." class="search-input"
                @input="searchUsers" />
            </div>
            <div v-if="loading" class="loading-message">
              <p>Loading users...</p>
            </div>
            <div v-else-if="!filteredUsers || filteredUsers.length === 0" class="empty-message">
              <p>No users found. Check browser console for details.</p>
            </div>
            <div v-else class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="text-left">Name</th>
                    <th class="text-left">Email</th>
                    <th class="text-right">Balance</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in filteredUsers" :key="user.id" class="table-row">
                    <td>
                      {{ (user.firstName || user.FirstName || '') + ' ' + (user.lastName || user.LastName || '') }}
                    </td>
                    <td>{{ user.email || user.Email }}</td>
                    <td class="text-right">{{ formatBalance(user.UserBalance || user.userBalance) }}</td>
                    <td class="text-center">
                      <button @click="openAddBalanceModal(user)" class="btn btn-success btn-sm">
                        Add Balance
                      </button>
                      <button @click="viewUserProgress(user)" class="btn btn-primary btn-sm ml-2">
                        View Progress
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- User Progress Modal -->
            <div v-if="showUserProgressModal" class="modal-overlay">
              <div class="modal-content modal-lg">
                <h2 class="modal-title">User Progress: {{ selectedUser?.firstName || selectedUser?.FirstName }} {{
                  selectedUser?.lastName || selectedUser?.LastName }}</h2>
                <div v-if="loadingUserProgress" class="loading-message">
                  <p>Loading progress data...</p>
                </div>
                <div v-else-if="userProgressData.length === 0" class="empty-message">
                  <p>No course progress data found for this user.</p>
                </div>
                <div v-else class="progress-data">
                  <div v-for="course in userProgressData" :key="course.courseId" class="course-progress-item">
                    <div class="course-header">
                      <h3>{{ course.courseTitle }}</h3>
                      <div class="progress-indicator">
                        <div class="progress-bar">
                          <div class="progress-fill" :style="{ width: course.progress + '%' }"></div>
                        </div>
                        <span class="progress-text">{{ course.progress }}%</span>
                      </div>
                    </div>
                    <div class="course-details">
                      <p>
                        <strong>Status:</strong> {{ course.isCompleted ? 'Completed' : 'In Progress' }}
                      </p>
                      <p>
                        <strong>Enrolled:</strong> {{ formatDate(course.enrolledAt) }}
                      </p>
                      <p>
                        <strong>Last Accessed:</strong> {{ formatDate(course.lastAccessed) }}
                      </p>
                      <p>
                        <strong>Lessons Completed:</strong> {{ course.completedLessons }} / {{ course.totalLessons }}
                      </p>
                      <!-- New: Show quiz and exam progress -->
                      <div class="quiz-progress-section">
                        <p>
                          <strong>Quizzes Completed:</strong>
                          {{ countCompletedQuizzes(course.lessonProgress) }} / {{
                            countTotalQuizzes(course.lessonProgress) }}
                        </p>
                        <p>
                          <strong>Final Exam:</strong>
                          {{ course.examCompleted ? 'Completed' : 'Not Completed' }}
                          <span v-if="course.examBestScore"> (Score: {{ course.examBestScore }}%)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="modal-actions">
                  <button @click="closeUserProgressModal" class="btn btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Courses Tab -->
          <div v-if="activeTab === 'courses'">
            <div class="section-header">
              <h2 class="section-title">Course Management</h2>
              <button @click="openAddCourseModal" class="btn btn-success">
                Add New Course
              </button>
            </div>
            <div class="search-container">
              <input type="text" v-model="courseSearchTerm" placeholder="Search courses..." class="search-input" />
            </div>
            <div v-if="loading" class="loading-message">
              <p>Loading courses...</p>
            </div>
            <div v-else-if="!filteredCourses || filteredCourses.length === 0" class="empty-message">
              <p>No courses found.</p>
            </div>
            <div v-else class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="text-left">Title</th>
                    <th class="text-left">Category</th>
                    <th class="text-right">Price</th>
                    <th class="text-center">Enrollments</th>
                    <th class="text-center">Premium</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="course in filteredCourses" :key="course.id" class="table-row">
                    <td>{{ course.title }}</td>
                    <td>{{ getCategoryName(course.categoryId) }}</td>
                    <td class="text-right">{{ formatPrice(course.price) }}</td>
                    <td class="text-center">{{ course.enrollmentCount || 0 }}</td>
                    <td class="text-center">
                      <span :class="course.isPremium ? 'text-success' : 'text-muted'">
                        {{ course.isPremium ? 'Yes' : 'No' }}
                      </span>
                    </td>
                    <td class="text-center">
                      <button @click="editCourse(course)" class="btn btn-primary btn-sm">
                        Edit
                      </button>
                      <button @click="viewEnrollments(course.id)" class="btn btn-info btn-sm mx-1">
                        Enrollments
                      </button>
                      <button @click="viewQuizAnalytics(course)" class="btn btn-success btn-sm mx-1">
                        Analytics
                      </button>
                      <button @click="deleteCourse(course.id)" class="btn btn-danger btn-sm">
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Course Enrollments Modal -->
            <div v-if="showEnrollmentsModal" class="modal-overlay">
              <div class="modal-content modal-lg">
                <h2 class="modal-title">Enrollments for: {{ selectedCourse?.title }}</h2>
                <div v-if="loadingEnrollments" class="loading-message">
                  <p>Loading enrollment data...</p>
                </div>
                <div v-else-if="!courseEnrollments || courseEnrollments.length === 0" class="empty-message">
                  <p>No enrollments found for this course.</p>
                </div>
                <div v-else class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th class="text-left">User</th>
                        <th class="text-left">Email</th>
                        <th class="text-center">Progress</th>
                        <th class="text-center">Enrolled Date</th>
                        <th class="text-center">Completed</th>
                        <th class="text-center">Final Exam</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="enrollment in courseEnrollments" :key="enrollment.id" class="table-row">
                        <td>{{ enrollment.user.firstName }} {{ enrollment.user.lastName }}</td>
                        <td>{{ enrollment.user.email }}</td>
                        <td class="text-center">
                          <div class="progress-micro">
                            <div class="progress-micro-fill" :style="{ width: enrollment.progress + '%' }"></div>
                          </div>
                          {{ enrollment.progress }}%
                        </td>
                        <td class="text-center">{{ formatDate(enrollment.enrolledAt) }}</td>
                        <td class="text-center">
                          <span :class="enrollment.isCompleted ? 'text-success' : 'text-muted'">
                            {{ enrollment.isCompleted ? 'Yes' : 'No' }}
                          </span>
                        </td>
                        <td class="text-center">
                          <span :class="enrollment.examCompleted ? 'text-success' : 'text-muted'">
                            {{ enrollment.examCompleted ? 'Passed' : 'Not Taken' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="modal-actions">
                  <button @click="closeEnrollmentsModal" class="btn btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>

            <!-- Quiz Analytics Modal -->
            <div v-if="showQuizAnalyticsModal" class="modal-overlay">
              <div class="modal-content modal-lg">
                <h2 class="modal-title">Analytics for: {{ selectedCourse?.title }}</h2>

                <div class="tabs">
                  <button @click="analyticsTab = 'exam'" :class="{ 'active': analyticsTab === 'exam' }" class="tab-btn">
                    Final Exam
                  </button>
                  <button @click="analyticsTab = 'quizzes'" :class="{ 'active': analyticsTab === 'quizzes' }"
                    class="tab-btn">
                    Lesson Quizzes
                  </button>
                </div>

                <div v-if="loadingAnalytics" class="loading-message">
                  <p>Loading analytics data...</p>
                </div>

                <!-- Final Exam Analytics -->
                <div v-else-if="analyticsTab === 'exam'" class="analytics-section">
                  <div v-if="!examAnalytics || !examAnalytics.totalAttempts" class="empty-message">
                    <p>No exam attempts recorded yet.</p>
                  </div>
                  <div v-else class="analytics-content">
                    <div class="analytics-overview">
                      <div class="stat-card">
                        <h3>Total Attempts</h3>
                        <p class="stat-value">{{ examAnalytics.totalAttempts }}</p>
                      </div>
                      <div class="stat-card">
                        <h3>Average Score</h3>
                        <p class="stat-value">{{ examAnalytics.averageScore }}%</p>
                      </div>
                      <div class="stat-card">
                        <h3>Pass Rate</h3>
                        <p class="stat-value">{{ examAnalytics.passRate }}%</p>
                      </div>
                    </div>

                    <h3 class="mt-4">Question Analysis</h3>
                    <div class="table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th class="text-left">Question</th>
                            <th class="text-center">Type</th>
                            <th class="text-center">Correct Rate</th>
                            <th class="text-center">Attempts</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="question in examAnalytics.questionAnalytics" :key="question.questionId"
                            class="table-row">
                            <td>{{ truncateText(question.text, 50) }}</td>
                            <td class="text-center">{{ formatQuestionType(question.type) }}</td>
                            <td class="text-center">
                              <div class="progress-micro">
                                <div class="progress-micro-fill"
                                  :style="{ width: question.correctRate + '%', backgroundColor: getCorrectRateColor(question.correctRate) }">
                                </div>
                              </div>
                              {{ question.correctRate }}%
                            </td>
                            <td class="text-center">{{ question.totalAttempted }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- Lesson Quizzes Analytics -->
                <div v-else-if="analyticsTab === 'quizzes'" class="analytics-section">
                  <div v-if="!selectedCourse || !selectedCourse.lessons || selectedCourse.lessons.length === 0"
                    class="empty-message">
                    <p>No lessons with quizzes available.</p>
                  </div>
                  <div v-else>
                    <div class="form-group">
                      <label for="lessonSelect" class="form-label">Select Lesson</label>
                      <select id="lessonSelect" v-model="selectedLessonId" class="form-select"
                        @change="loadLessonQuizAnalytics">
                        <option v-for="lesson in selectedCourse.lessons" :key="lesson.id" :value="lesson.id">
                          {{ lesson.title }}
                        </option>
                      </select>
                    </div>

                    <div v-if="loadingLessonAnalytics" class="loading-message">
                      <p>Loading lesson quiz analytics...</p>
                    </div>
                    <div v-else-if="!quizAnalytics || !quizAnalytics.totalAttempts" class="empty-message">
                      <p>No quiz attempts recorded for this lesson yet.</p>
                    </div>
                    <div v-else class="analytics-content">
                      <div class="analytics-overview">
                        <div class="stat-card">
                          <h3>Total Attempts</h3>
                          <p class="stat-value">{{ quizAnalytics.totalAttempts }}</p>
                        </div>
                        <div class="stat-card">
                          <h3>Average Score</h3>
                          <p class="stat-value">{{ quizAnalytics.averageScore }}%</p>
                        </div>
                        <div class="stat-card">
                          <h3>Pass Rate</h3>
                          <p class="stat-value">{{ quizAnalytics.passRate }}%</p>
                        </div>
                      </div>

                      <h3 class="mt-4">Question Analysis</h3>
                      <div class="table-container">
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th class="text-left">Question</th>
                              <th class="text-center">Type</th>
                              <th class="text-center">Correct Rate</th>
                              <th class="text-center">Attempts</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="question in quizAnalytics.questionAnalytics" :key="question.questionId"
                              class="table-row">
                              <td>{{ truncateText(question.text, 50) }}</td>
                              <td class="text-center">{{ formatQuestionType(question.type) }}</td>
                              <td class="text-center">
                                <div class="progress-micro">
                                  <div class="progress-micro-fill"
                                    :style="{ width: question.correctRate + '%', backgroundColor: getCorrectRateColor(question.correctRate) }">
                                  </div>
                                </div>
                                {{ question.correctRate }}%
                              </td>
                              <td class="text-center">{{ question.totalAttempted }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="modal-actions">
                  <button @click="closeQuizAnalyticsModal" class="btn btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Assign Courses Tab -->
          <div v-if="activeTab === 'assign'">
            <h2 class="section-title">Assign Courses to Users</h2>
            <div class="assign-grid">
              <div class="assign-column">
                <h3 class="subsection-title">1. Select User</h3>
                <input type="text" v-model="assignUserSearchTerm" placeholder="Search users..." class="search-input"
                  @input="searchAssignUsers" />
                <div class="selection-list">
                  <div v-for="user in filteredAssignUsers" :key="user.id || user.uid || user.email"
                    @click="selectUserForAssignment(user)" class="selection-item"
                    :class="{ 'selected': selectedUser?.id === user.id }">
                    {{ (user.firstName || user.FirstName || '') + ' ' + (user.lastName || user.LastName || '') }}
                    ({{ user.email || user.Email }})
                    <small v-if="user.id">ID: {{ user.id }}</small>
                  </div>
                  <div v-if="!filteredAssignUsers || filteredAssignUsers.length === 0" class="empty-selection">
                    No users found
                  </div>
                </div>
              </div>
              <div class="assign-column">
                <h3 class="subsection-title">2. Select Course</h3>
                <input type="text" v-model="assignCourseSearchTerm" placeholder="Search courses..."
                  class="search-input" />
                <div class="selection-list">
                  <div v-for="course in filteredAssignCourses" :key="course.id"
                    @click="selectCourseForAssignment(course)" class="selection-item"
                    :class="{ 'selected': selectedCourse?.id === course.id }">
                    {{ course.title }}
                    <small v-if="course.id">ID: {{ course.id }}</small>
                  </div>
                  <div v-if="!filteredAssignCourses || filteredAssignCourses.length === 0" class="empty-selection">
                    No courses available
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedUser || selectedCourse" class="selected-items">
              <div v-if="selectedUser" class="selected-item">
                <strong>Selected User:</strong> {{ selectedUser.firstName || selectedUser.FirstName || '' }}
                {{ selectedUser.lastName || selectedUser.LastName || '' }}
                (ID: {{ selectedUser.id }})
              </div>
              <div v-if="selectedCourse" class="selected-item">
                <strong>Selected Course:</strong> {{ selectedCourse.title }}
                (ID: {{ selectedCourse.id }})
              </div>
            </div>
            <div class="action-container">
              <button @click="assignCourse" class="btn btn-success"
                :disabled="!selectedUser || !selectedCourse || assigningCourse">
                {{ assigningCourse ? 'Assigning...' : 'Assign Course to User' }}
              </button>
              <div v-if="assignmentResult"
                :class="['assignment-result', assignmentResult.success ? 'success' : 'error']">
                {{ assignmentResult.message }}
              </div>
              <!-- Add a fallback direct assignment option -->
              <div class="mt-5" v-if="showDirectAssignment">
                <h3 class="subsection-title">Direct Course Assignment</h3>
                <p class="note">Use this method if the normal assignment fails</p>
                <div class="form-group">
                  <label class="form-label">Course ID</label>
                  <input type="text" v-model="directCourseId" class="form-input" placeholder="Enter course ID" />
                </div>
                <div class="form-group">
                  <label class="form-label">Course Title</label>
                  <input type="text" v-model="directCourseTitle" class="form-input" placeholder="Enter course title" />
                </div>
                <button @click="directlyAssignCourse" class="btn btn-primary"
                  :disabled="!selectedUser || !directCourseId || !directCourseTitle || directAssigning">
                  {{ directAssigning ? 'Assigning...' : 'Direct Assign Course' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Analytics Tab -->
          <div v-if="activeTab === 'analytics'">
            <div class="section-header">
              <h2 class="section-title">Course Analytics Overview</h2>
            </div>

            <div class="analytics-filters">
              <div class="form-group">
                <label for="analyticsCourseSelect" class="form-label">Select Course</label>
                <select id="analyticsCourseSelect" v-model="analyticsSelectedCourseId" class="form-select"
                  @change="loadCourseAnalytics">
                  <option value="">-- Select a course --</option>
                  <option v-for="course in courses" :key="course.id" :value="course.id">
                    {{ course.title }}
                  </option>
                </select>
              </div>
            </div>

            <div v-if="!analyticsSelectedCourseId" class="empty-message mt-4">
              <p>Select a course to view analytics</p>
            </div>

            <div v-else-if="loadingAnalytics" class="loading-message">
              <p>Loading analytics data...</p>
            </div>

            <div v-else class="analytics-dashboard mt-4">
              <div class="section-card">
                <h3>Course Completion Analytics</h3>
                <div class="analytics-grid">
                  <div class="stat-card">
                    <h4>Total Enrollments</h4>
                    <p class="stat-value">{{ courseAnalytics.totalEnrollments || 0 }}</p>
                  </div>
                  <div class="stat-card">
                    <h4>Completion Rate</h4>
                    <p class="stat-value">{{ courseAnalytics.completionRate || 0 }}%</p>
                  </div>
                  <div class="stat-card">
                    <h4>Avg. Progress</h4>
                    <p class="stat-value">{{ courseAnalytics.avgProgress || 0 }}%</p>
                  </div>
                </div>
              </div>

              <div class="section-card">
                <h3>Quiz Performance</h3>
                <div class="analytics-grid">
                  <div class="stat-card">
                    <h4>Quiz Attempts</h4>
                    <p class="stat-value">{{ courseAnalytics.totalQuizAttempts || 0 }}</p>
                  </div>
                  <div class="stat-card">
                    <h4>Avg. Quiz Score</h4>
                    <p class="stat-value">{{ courseAnalytics.avgQuizScore || 0 }}%</p>
                  </div>
                  <div class="stat-card">
                    <h4>Quiz Pass Rate</h4>
                    <p class="stat-value">{{ courseAnalytics.quizPassRate || 0 }}%</p>
                  </div>
                </div>
              </div>

              <div class="section-card">
                <h3>Final Exam Performance</h3>
                <div class="analytics-grid">
                  <div class="stat-card">
                    <h4>Exam Attempts</h4>
                    <p class="stat-value">{{ courseAnalytics.totalExamAttempts || 0 }}</p>
                  </div>
                  <div class="stat-card">
                    <h4>Avg. Exam Score</h4>
                    <p class="stat-value">{{ courseAnalytics.avgExamScore || 0 }}%</p>
                  </div>
                  <div class="stat-card">
                    <h4>Exam Pass Rate</h4>
                    <p class="stat-value">{{ courseAnalytics.examPassRate || 0 }}%</p>
                  </div>
                </div>
              </div>

              <div class="section-card">
                <h3>Difficulty Analysis</h3>
                <div v-if="!courseAnalytics.difficultQuestions || courseAnalytics.difficultQuestions.length === 0"
                  class="empty-message">
                  <p>No question difficulty data available</p>
                </div>
                <div v-else class="table-container">
                  <h4>Most Challenging Questions</h4>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th class="text-left">Question</th>
                        <th class="text-center">Type</th>
                        <th class="text-center">Source</th>
                        <th class="text-center">Correct Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="question in courseAnalytics.difficultQuestions" :key="question.questionId"
                        class="table-row">
                        <td>{{ truncateText(question.text, 50) }}</td>
                        <td class="text-center">{{ formatQuestionType(question.type) }}</td>
                        <td class="text-center">{{ question.source === 'exam' ? 'Final Exam' : 'Lesson Quiz' }}</td>
                        <td class="text-center">
                          <div class="progress-micro">
                            <div class="progress-micro-fill"
                              :style="{ width: question.correctRate + '%', backgroundColor: getCorrectRateColor(question.correctRate) }">
                            </div>
                          </div>
                          {{ question.correctRate }}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Add Balance Modal -->
    <div v-if="showAddBalanceModal" class="modal-overlay">
      <div class="modal-content">
        <h2 class="modal-title">Add Balance</h2>
        <p class="modal-subtitle">Add balance for {{ selectedUser?.firstName || selectedUser?.FirstName }} {{
          selectedUser?.lastName || selectedUser?.LastName }}</p>
        <div class="form-group">
          <label for="balanceAmount" class="form-label">Amount</label>
          <input type="number" id="balanceAmount" v-model="balanceAmount" min="0" step="0.01" class="form-input"
            required />
        </div>
        <div v-if="balanceUpdateResult" :class="['form-feedback', balanceUpdateResult.success ? 'success' : 'error']">
          {{ balanceUpdateResult.message }}
        </div>
        <div class="modal-actions">
          <button @click="closeAddBalanceModal" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="addBalance" class="btn btn-success" :disabled="addingBalance">
            {{ addingBalance ? 'Adding...' : 'Add Balance' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Course Modal -->
    <div v-if="showCourseModal" class="modal-overlay">
      <div class="modal-content modal-xl">
        <h2 class="modal-title">{{ editingCourse ? 'Edit Course' : 'Add New Course' }}</h2>

        <!-- Course Form Tabs -->
        <div class="form-tabs">
          <button @click="activeFormTab = 'basic'" :class="{ 'active': activeFormTab === 'basic' }" class="tab-btn">
            Basic Info
          </button>
          <button @click="activeFormTab = 'lessons'" :class="{ 'active': activeFormTab === 'lessons' }" class="tab-btn">
            Lessons
          </button>
          <button @click="activeFormTab = 'exam'" :class="{ 'active': activeFormTab === 'exam' }" class="tab-btn">
            Final Exam
          </button>
        </div>

        <!-- Basic Info Tab -->
        <div v-if="activeFormTab === 'basic'" class="form-tab-content">
          <div class="form-group">
            <label for="courseTitle" class="form-label">Title*</label>
            <input type="text" id="courseTitle" v-model="courseForm.title" class="form-input" required />
          </div>
          <div class="form-group">
            <label for="courseDescription" class="form-label">Description*</label>
            <textarea id="courseDescription" v-model="courseForm.description" class="form-textarea" rows="3"
              required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label for="courseCategory" class="form-label">Category*</label>
              <select id="courseCategory" v-model="courseForm.categoryId" class="form-select" required>
                <option value="1">Programming</option>
                <option value="2">Design</option>
                <option value="3">Business</option>
                <option value="4">Music</option>
                <option value="5">Photography</option>
                <option value="6">Language</option>
                <option value="7">Health & Fitness</option>
                <option value="8">Personal Development</option>
              </select>
            </div>
            <div class="form-group form-group-half">
              <label for="coursePrice" class="form-label">Price*</label>
              <div class="price-container">
                <div class="checkbox-container mb-sm">
                  <input type="checkbox" id="courseFree" v-model="isFree" class="checkbox-input" />
                  <label for="courseFree" class="checkbox-label">Free Course</label>
                </div>
                <input type="number" id="coursePrice" v-model="courseForm.price" min="0" step="0.01" class="form-input"
                  :disabled="isFree" required />
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label for="courseLevel" class="form-label">Level*</label>
              <select id="courseLevel" v-model="courseForm.level" class="form-select" required>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Beginner to Advanced">Beginner to Advanced</option>
              </select>
            </div>
            <div class="form-group form-group-half">
              <label for="courseImageUrl" class="form-label">Image URL*</label>
              <input type="text" id="courseImageUrl" v-model="courseForm.imageUrl" class="form-input" required />
            </div>
          </div>
          <div class="form-group">
            <div class="checkbox-container">
              <input type="checkbox" id="coursePremium" v-model="courseForm.isPremium" class="checkbox-input" />
              <label for="coursePremium" class="checkbox-label">Premium Course</label>
            </div>
          </div>
          <!-- Course Requirements -->
          <div class="form-group">
            <label class="form-label">Course Requirements</label>
            <div class="list-editor">
              <div v-for="(req, index) in courseForm.requirements" :key="'req-' + index" class="list-item">
                <input type="text" v-model="courseForm.requirements[index]" class="form-input"
                  placeholder="Enter requirement" />
                <button type="button" @click="removeRequirement(index)" class="btn btn-danger btn-sm">
                  Remove
                </button>
              </div>
              <button type="button" @click="addRequirement" class="btn btn-secondary btn-sm">
                Add Requirement
              </button>
            </div>
          </div>
          <!-- What You Will Learn -->
          <div class="form-group">
            <label class="form-label">What You Will Learn</label>
            <div class="list-editor">
              <div v-for="(item, index) in courseForm.whatYouWillLearn" :key="'learn-' + index" class="list-item">
                <input type="text" v-model="courseForm.whatYouWillLearn[index]" class="form-input"
                  placeholder="Enter learning objective" />
                <button type="button" @click="removeWhatYouWillLearn(index)" class="btn btn-danger btn-sm">
                  Remove
                </button>
              </div>
              <button type="button" @click="addWhatYouWillLearn" class="btn btn-secondary btn-sm">
                Add Learning Objective
              </button>
            </div>
          </div>
        </div>

        <!-- Lessons Tab -->
        <div v-if="activeFormTab === 'lessons'" class="form-tab-content">
          <div class="lessons-container">
            <div v-for="(lesson, index) in courseForm.lessons" :key="'lesson-' + index" class="lesson-item">
              <div class="lesson-header" @click="toggleLessonCollapse(index)">
                <span>{{ lesson.title || 'New Lesson' }}</span>
                <div class="lesson-header-actions">
                  <button type="button" @click.stop="toggleLessonQuizEditor(index)" class="btn btn-primary btn-sm mr-2">
                    {{ isLessonQuizEditorOpen(index) ? 'Hide Quiz' : 'Edit Quiz' }}
                  </button>
                  <button type="button" @click.stop="removeLessonItem(index)" class="btn btn-danger btn-sm">
                    Delete
                  </button>
                </div>
              </div>
              <div class="lesson-details" v-show="!lesson.collapsed">
                <div class="form-group">
                  <label class="form-label">Title*</label>
                  <input type="text" v-model="lesson.title" class="form-input" placeholder="Enter lesson title"
                    required />
                </div>
                <div class="form-group">
                  <label class="form-label">Description</label>
                  <textarea v-model="lesson.description" class="form-textarea" placeholder="Enter lesson description"
                    rows="2"></textarea>
                </div>
                <div class="form-row">
                  <div class="form-group form-group-half">
                    <label class="form-label">Video URL</label>
                    <input type="text" v-model="lesson.videoUrl" class="form-input" placeholder="Enter video URL" />
                  </div>
                  <div class="form-group form-group-half">
                    <label class="form-label">Duration (minutes)</label>
                    <input type="number" v-model="lesson.duration" class="form-input" min="1"
                      placeholder="Duration in minutes" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group form-group-half">
                    <div class="checkbox-container">
                      <input type="checkbox" v-model="lesson.isPreview" :id="'preview-' + index"
                        class="checkbox-input" />
                      <label :for="'preview-' + index" class="checkbox-label">Preview Lesson</label>
                    </div>
                  </div>
                  <div class="form-group form-group-half">
                    <div class="checkbox-container">
                      <input type="checkbox" v-model="lesson.isLocked" :id="'locked-' + index" class="checkbox-input" />
                      <label :for="'locked-' + index" class="checkbox-label">Locked Lesson</label>
                    </div>
                  </div>
                </div>
                <!-- Lesson Resources -->
                <div class="form-group">
                  <label class="form-label">Resources</label>
                  <div class="list-editor">
                    <div v-for="(resource, rIndex) in lesson.resources" :key="'resource-' + index + '-' + rIndex"
                      class="resource-item">
                      <div class="form-row">
                        <div class="form-group form-group-half">
                          <input type="text" v-model="resource.title" class="form-input" placeholder="Resource title" />
                        </div>
                        <div class="form-group form-group-half resource-actions">
                          <select v-model="resource.type" class="form-select">
                            <option value="pdf">PDF</option>
                            <option value="doc">Document</option>
                            <option value="video">Video</option>
                            <option value="link">Link</option>
                          </select>
                          <button type="button" @click="removeResourceItem(index, rIndex)"
                            class="btn btn-danger btn-sm">
                            Remove
                          </button>
                        </div>
                      </div>
                      <input type="text" v-model="resource.url" class="form-input" placeholder="Resource URL" />
                    </div>
                    <button type="button" @click="addResourceItem(index)" class="btn btn-secondary btn-sm">
                      Add Resource
                    </button>
                  </div>
                </div>

                <!-- Quiz Editor -->
                <div v-if="isLessonQuizEditorOpen(index)" class="quiz-editor">
                  <div class="quiz-editor-header">
                    <h3>Lesson Quiz</h3>
                  </div>

                  <div class="form-group">
                    <div class="checkbox-container">
                      <input type="checkbox" v-model="lesson.quiz.isEnabled" :id="'quiz-enabled-' + index"
                        class="checkbox-input" />
                      <label :for="'quiz-enabled-' + index" class="checkbox-label">Enable Quiz</label>
                    </div>
                  </div>

                  <div v-if="lesson.quiz.isEnabled" class="quiz-settings">
                    <div class="form-group">
                      <label class="form-label">Quiz Title</label>
                      <input type="text" v-model="lesson.quiz.title" class="form-input" placeholder="Quiz title" />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Description</label>
                      <textarea v-model="lesson.quiz.description" class="form-textarea" placeholder="Quiz description"
                        rows="2"></textarea>
                    </div>

                    <div class="form-row">
                      <div class="form-group form-group-half">
                        <label class="form-label">Time Limit (minutes)</label>
                        <input type="number" v-model="lesson.quiz.timeLimit" class="form-input" min="1"
                          placeholder="Time limit" />
                      </div>
                      <div class="form-group form-group-half">
                        <label class="form-label">Passing Score (%)</label>
                        <input type="number" v-model="lesson.quiz.passingScore" class="form-input" min="1" max="100"
                          placeholder="Passing score" />
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group form-group-half">
                        <label class="form-label">Attempts Allowed (0 = unlimited)</label>
                        <input type="number" v-model="lesson.quiz.attemptsAllowed" class="form-input" min="0"
                          placeholder="Attempts allowed" />
                      </div>
                      <div class="form-group form-group-half">
                        <div class="checkbox-container mt-4">
                          <input type="checkbox" v-model="lesson.quiz.shuffleQuestions"
                            :id="'shuffle-questions-' + index" class="checkbox-input" />
                          <label :for="'shuffle-questions-' + index" class="checkbox-label">Shuffle Questions</label>
                        </div>
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group form-group-half">
                        <div class="checkbox-container">
                          <input type="checkbox" v-model="lesson.quiz.showFeedback" :id="'show-feedback-' + index"
                            class="checkbox-input" />
                          <label :for="'show-feedback-' + index" class="checkbox-label">Show Answer Feedback</label>
                        </div>
                      </div>
                      <div class="form-group form-group-half">
                        <div class="checkbox-container">
                          <input type="checkbox" v-model="lesson.quiz.allowReview" :id="'allow-review-' + index"
                            class="checkbox-input" />
                          <label :for="'allow-review-' + index" class="checkbox-label">Allow Review After
                            Submission</label>
                        </div>
                      </div>
                    </div>

                    <!-- Quiz Questions Section -->
                    <div class="quiz-questions-section">
                      <h4>Quiz Questions</h4>

                      <div v-if="!lesson.quiz.questions || lesson.quiz.questions.length === 0" class="empty-message">
                        <p>No questions added yet.</p>
                      </div>

                      <div v-else class="questions-list">
                        <div v-for="(question, qIndex) in lesson.quiz.questions"
                          :key="'quiz-question-' + index + '-' + qIndex" class="question-item">
                          <div class="question-header" @click="toggleQuestionCollapse(index, qIndex)">
                            <span>{{ question.text || 'New Question' }}</span>
                            <div class="question-type-badge">{{ formatQuestionType(question.type) }}</div>
                            <button type="button" @click.stop="removeQuizQuestion(index, qIndex)"
                              class="btn btn-danger btn-sm">
                              Remove
                            </button>
                          </div>

                          <div class="question-details" v-show="!question.collapsed">
                            <div class="form-group">
                              <label class="form-label">Question Text*</label>
                              <textarea v-model="question.text" class="form-textarea" placeholder="Enter question"
                                rows="2" required></textarea>
                            </div>

                            <div class="form-row">
                              <div class="form-group form-group-half">
                                <label class="form-label">Question Type</label>
                                <select v-model="question.type" class="form-select"
                                  @change="handleQuestionTypeChange(question)">
                                  <option value="multiple-choice">Multiple Choice</option>
                                  <option value="true-false">True/False</option>
                                  <option value="multiple-answer">Multiple Answer</option>
                                  <option value="text">Text Answer</option>
                                  <option value="matching">Matching</option>
                                </select>
                              </div>
                              <div class="form-group form-group-half">
                                <label class="form-label">Points</label>
                                <input type="number" v-model="question.points" class="form-input" min="1"
                                  placeholder="Question points" />
                              </div>
                            </div>

                            <!-- Question Type Specific UI -->
                            <!-- Multiple Choice -->
                            <div v-if="question.type === 'multiple-choice'" class="question-type-content">
                              <div class="form-group">
                                <label class="form-label">Options</label>
                                <div v-for="(option, oIndex) in question.options"
                                  :key="'option-' + qIndex + '-' + oIndex" class="option-item">
                                  <div class="option-row">
                                    <div class="radio-container">
                                      <input type="radio" :id="'option-radio-' + index + '-' + qIndex + '-' + oIndex"
                                        :name="'question-' + index + '-' + qIndex" :value="oIndex"
                                        v-model="question.correctAnswer" class="radio-input" />
                                      <label :for="'option-radio-' + index + '-' + qIndex + '-' + oIndex"
                                        class="radio-label">
                                        Correct
                                      </label>
                                    </div>
                                    <input type="text" v-model="option.text" class="form-input"
                                      placeholder="Option text" />
                                    <button type="button" @click="removeQuestionOption(question, oIndex)"
                                      class="btn btn-danger btn-sm">
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                <button type="button" @click="addQuestionOption(question)"
                                  class="btn btn-secondary btn-sm mt-2">
                                  Add Option
                                </button>
                              </div>
                            </div>

                            <!-- True/False -->
                            <div v-if="question.type === 'true-false'" class="question-type-content">
                              <div class="form-group">
                                <label class="form-label">Correct Answer</label>
                                <div class="radio-group">
                                  <div class="radio-container">
                                    <input type="radio" :id="'true-option-' + index + '-' + qIndex"
                                      :name="'tf-question-' + index + '-' + qIndex" :value="true"
                                      v-model="question.correctAnswer" class="radio-input" />
                                    <label :for="'true-option-' + index + '-' + qIndex" class="radio-label">
                                      True
                                    </label>
                                  </div>
                                  <div class="radio-container">
                                    <input type="radio" :id="'false-option-' + index + '-' + qIndex"
                                      :name="'tf-question-' + index + '-' + qIndex" :value="false"
                                      v-model="question.correctAnswer" class="radio-input" />
                                    <label :for="'false-option-' + index + '-' + qIndex" class="radio-label">
                                      False
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <!-- Multiple Answer -->
                            <div v-if="question.type === 'multiple-answer'" class="question-type-content">
                              <div class="form-group">
                                <label class="form-label">Options (select all correct answers)</label>
                                <div v-for="(option, oIndex) in question.options"
                                  :key="'ma-option-' + qIndex + '-' + oIndex" class="option-item">
                                  <div class="option-row">
                                    <div class="checkbox-container">
                                      <input type="checkbox" :id="'ma-checkbox-' + index + '-' + qIndex + '-' + oIndex"
                                        :value="oIndex" v-model="question.correctAnswers" class="checkbox-input" />
                                      <label :for="'ma-checkbox-' + index + '-' + qIndex + '-' + oIndex"
                                        class="checkbox-label">
                                        Correct
                                      </label>
                                    </div>
                                    <input type="text" v-model="option.text" class="form-input"
                                      placeholder="Option text" />
                                    <button type="button" @click="removeQuestionOption(question, oIndex)"
                                      class="btn btn-danger btn-sm">
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                <button type="button" @click="addQuestionOption(question)"
                                  class="btn btn-secondary btn-sm mt-2">
                                  Add Option
                                </button>
                              </div>
                            </div>

                            <!-- Text Answer -->
                            <div v-if="question.type === 'text'" class="question-type-content">
                              <div class="form-group">
                                <label class="form-label">Accepted Answers (one per line)</label>
                                <textarea v-model="textAnswersInput" class="form-textarea"
                                  placeholder="Enter accepted answers (one per line)" rows="3"
                                  @input="updateTextAnswers(question)"></textarea>
                              </div>
                              <div class="form-group">
                                <div class="checkbox-container">
                                  <input type="checkbox" :id="'case-sensitive-' + index + '-' + qIndex"
                                    v-model="question.caseSensitive" class="checkbox-input" />
                                  <label :for="'case-sensitive-' + index + '-' + qIndex" class="checkbox-label">
                                    Case Sensitive
                                  </label>
                                </div>
                              </div>
                            </div>

                            <!-- Matching -->
                            <div v-if="question.type === 'matching'" class="question-type-content">
                              <div class="form-group">
                                <label class="form-label">Matching Pairs</label>
                                <div v-for="(pair, pIndex) in question.pairs" :key="'pair-' + qIndex + '-' + pIndex"
                                  class="matching-pair">
                                  <div class="pair-row">
                                    <input type="text" v-model="pair.left" class="form-input" placeholder="Left item" />
                                    <span class="pair-separator">→</span>
                                    <input type="text" v-model="pair.right" class="form-input"
                                      placeholder="Right item" />
                                    <button type="button" @click="removeMatchingPair(question, pIndex)"
                                      class="btn btn-danger btn-sm">
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                <button type="button" @click="addMatchingPair(question)"
                                  class="btn btn-secondary btn-sm mt-2">
                                  Add Pair
                                </button>
                              </div>
                            </div>

                            <!-- Explanation for all question types -->
                            <div class="form-group">
                              <label class="form-label">Explanation (shown after answering)</label>
                              <textarea v-model="question.explanation" class="form-textarea"
                                placeholder="Explain the correct answer" rows="2"></textarea>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="add-question-container">
                        <button type="button" @click="addQuizQuestion(index)" class="btn btn-primary">
                          Add New Question
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" @click="addLessonItem" class="btn btn-primary">
              Add New Lesson
            </button>
          </div>
        </div>

        <!-- Final Exam Tab -->
        <div v-if="activeFormTab === 'exam'" class="form-tab-content">
          <div class="exam-editor">
            <div class="form-group">
              <div class="checkbox-container">
                <input type="checkbox" v-model="courseForm.finalExam.isEnabled" id="exam-enabled"
                  class="checkbox-input" />
                <label for="exam-enabled" class="checkbox-label">Enable Final Exam</label>
              </div>
            </div>

            <div v-if="courseForm.finalExam.isEnabled" class="exam-settings">
              <div class="form-group">
                <label class="form-label">Exam Title</label>
                <input type="text" v-model="courseForm.finalExam.title" class="form-input" placeholder="Exam title" />
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea v-model="courseForm.finalExam.description" class="form-textarea"
                  placeholder="Exam description" rows="2"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group form-group-half">
                  <label class="form-label">Time Limit (minutes)</label>
                  <input type="number" v-model="courseForm.finalExam.timeLimit" class="form-input" min="1"
                    placeholder="Time limit" />
                </div>
                <div class="form-group form-group-half">
                  <label class="form-label">Passing Score (%)</label>
                  <input type="number" v-model="courseForm.finalExam.passingScore" class="form-input" min="1" max="100"
                    placeholder="Passing score" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-half">
                  <label class="form-label">Attempts Allowed</label>
                  <input type="number" v-model="courseForm.finalExam.attemptsAllowed" class="form-input" min="1"
                    placeholder="Attempts allowed" />
                </div>
                <div class="form-group form-group-half">
                  <div class="checkbox-container mt-4">
                    <input type="checkbox" v-model="courseForm.finalExam.requireAllLessonsCompleted"
                      id="require-lessons" class="checkbox-input" />
                    <label for="require-lessons" class="checkbox-label">Require All Lessons Completed</label>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-half">
                  <div class="checkbox-container">
                    <input type="checkbox" v-model="courseForm.finalExam.shuffleQuestions" id="exam-shuffle-questions"
                      class="checkbox-input" />
                    <label for="exam-shuffle-questions" class="checkbox-label">Shuffle Questions</label>
                  </div>
                </div>
                <div class="form-group form-group-half">
                  <div class="checkbox-container">
                    <input type="checkbox" v-model="courseForm.finalExam.shuffleOptions" id="exam-shuffle-options"
                      class="checkbox-input" />
                    <label for="exam-shuffle-options" class="checkbox-label">Shuffle Options</label>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-half">
                  <div class="checkbox-container">
                    <input type="checkbox" v-model="courseForm.finalExam.showFeedback" id="exam-show-feedback"
                      class="checkbox-input" />
                    <label for="exam-show-feedback" class="checkbox-label">Show Answer Feedback</label>
                  </div>
                </div>
                <div class="form-group form-group-half">
                  <div class="checkbox-container">
                    <input type="checkbox" v-model="courseForm.finalExam.allowReview" id="exam-allow-review"
                      class="checkbox-input" />
                    <label for="exam-allow-review" class="checkbox-label">Allow Review After Submission</label>
                  </div>
                </div>
              </div>

              <!-- Exam Questions Section -->
              <div class="exam-questions-section">
                <h4>Exam Questions</h4>

                <div v-if="!courseForm.finalExam.questions || courseForm.finalExam.questions.length === 0"
                  class="empty-message">
                  <p>No questions added yet.</p>
                </div>

                <div v-else class="questions-list">
                  <div v-for="(question, qIndex) in courseForm.finalExam.questions" :key="'exam-question-' + qIndex"
                    class="question-item">
                    <div class="question-header" @click="toggleExamQuestionCollapse(qIndex)">
                      <span>{{ question.text || 'New Question' }}</span>
                      <div class="question-type-badge">{{ formatQuestionType(question.type) }}</div>
                      <button type="button" @click.stop="removeExamQuestion(qIndex)" class="btn btn-danger btn-sm">
                        Remove
                      </button>
                    </div>

                    <div class="question-details" v-show="!question.collapsed">
                      <!-- Similar to quiz question editor, but for exam questions -->
                      <div class="form-group">
                        <label class="form-label">Question Text*</label>
                        <textarea v-model="question.text" class="form-textarea" placeholder="Enter question" rows="2"
                          required></textarea>
                      </div>

                      <div class="form-row">
                        <div class="form-group form-group-half">
                          <label class="form-label">Question Type</label>
                          <select v-model="question.type" class="form-select"
                            @change="handleExamQuestionTypeChange(question)">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="true-false">True/False</option>
                            <option value="multiple-answer">Multiple Answer</option>
                            <option value="text">Text Answer</option>
                            <option value="matching">Matching</option>
                          </select>
                        </div>
                        <div class="form-group form-group-half">
                          <label class="form-label">Points</label>
                          <input type="number" v-model="question.points" class="form-input" min="1"
                            placeholder="Question points" />
                        </div>
                      </div>

                      <!-- Question Type Specific UI - Similar to quiz questions -->
                      <!-- Multiple Choice -->
                      <div v-if="question.type === 'multiple-choice'" class="question-type-content">
                        <div class="form-group">
                          <label class="form-label">Options</label>
                          <div v-for="(option, oIndex) in question.options"
                            :key="'exam-option-' + qIndex + '-' + oIndex" class="option-item">
                            <div class="option-row">
                              <div class="radio-container">
                                <input type="radio" :id="'exam-option-radio-' + qIndex + '-' + oIndex"
                                  :name="'exam-question-' + qIndex" :value="oIndex" v-model="question.correctAnswer"
                                  class="radio-input" />
                                <label :for="'exam-option-radio-' + qIndex + '-' + oIndex" class="radio-label">
                                  Correct
                                </label>
                              </div>
                              <input type="text" v-model="option.text" class="form-input" placeholder="Option text" />
                              <button type="button" @click="removeExamQuestionOption(question, oIndex)"
                                class="btn btn-danger btn-sm">
                                Remove
                              </button>
                            </div>
                          </div>
                          <button type="button" @click="addExamQuestionOption(question)"
                            class="btn btn-secondary btn-sm mt-2">
                            Add Option
                          </button>
                        </div>
                      </div>

                      <!-- Other question types would be implemented here similarly -->

                      <!-- Explanation for all question types -->
                      <div class="form-group">
                        <label class="form-label">Explanation (shown after answering)</label>
                        <textarea v-model="question.explanation" class="form-textarea"
                          placeholder="Explain the correct answer" rows="2"></textarea>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="add-question-container">
                  <button type="button" @click="addExamQuestion" class="btn btn-primary">
                    Add New Question
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closeCourseModal" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="saveCourse" class="btn btn-success" :disabled="savingCourse">
            {{ savingCourse ? 'Saving...' : 'Save Course' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { auth } from '../firebase/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'vue-router';
import UserService from '../services/UserService';
import CourseEnrollmentService from '../services/CourseEnrollmentService';
import CourseService from '../services/CourseService';

// Define category mapping
const categories = {
  '1': 'Programming',
  '2': 'Design',
  '3': 'Business',
  '4': 'Music',
  '5': 'Photography',
  '6': 'Language',
  '7': 'Health & Fitness',
  '8': 'Personal Development'
};

export default {
  name: 'AdminDashboard',
  setup() {
    const router = useRouter();
    const activeTab = ref('users');
    const loading = ref(false);
    const users = ref([]);
    const courses = ref([]);
    const userSearchTerm = ref('');
    const courseSearchTerm = ref('');
    const assignUserSearchTerm = ref('');
    const assignCourseSearchTerm = ref('');
    const selectedUser = ref(null);
    const selectedCourse = ref(null);
    const assigningCourse = ref(false);
    const assignmentResult = ref(null);
    const showDirectAssignment = ref(false);
    const directCourseId = ref('');
    const directCourseTitle = ref('');
    const directAssigning = ref(false);

    // Add Balance Modal
    const showAddBalanceModal = ref(false);
    const balanceAmount = ref(0);
    const addingBalance = ref(false);
    const balanceUpdateResult = ref(null);

    // Course Modal
    const showCourseModal = ref(false);
    const editingCourse = ref(false);
    const savingCourse = ref(false);
    const isFree = ref(false);
    const activeFormTab = ref('basic');
    const textAnswersInput = ref('');
    const openLessonQuizEditors = ref({});

    // Course Form with Quiz & Final Exam structure
    const courseForm = ref({
      id: '',
      title: '',
      description: '',
      categoryId: '1',
      price: 0,
      level: 'Beginner',
      imageUrl: '',
      isPremium: false,
      requirements: [''],
      whatYouWillLearn: [''],
      lessons: [],
      finalExam: {
        id: crypto.randomUUID(),
        title: '',
        description: 'Test your understanding of the entire course',
        questions: [],
        timeLimit: 30,
        passingScore: 70,
        attemptsAllowed: 3,
        requireAllLessonsCompleted: true,
        isEnabled: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        showFeedback: true,
        allowReview: true
      }
    });

    // User Progress Modal
    const showUserProgressModal = ref(false);
    const loadingUserProgress = ref(false);
    const userProgressData = ref([]);

    // Course Enrollments Modal
    const showEnrollmentsModal = ref(false);
    const loadingEnrollments = ref(false);
    const courseEnrollments = ref([]);

    // Quiz Analytics Modal
    const showQuizAnalyticsModal = ref(false);
    const loadingAnalytics = ref(false);
    const loadingLessonAnalytics = ref(false);
    const analyticsTab = ref('exam');
    const selectedLessonId = ref('');
    const quizAnalytics = ref(null);
    const examAnalytics = ref(null);

    // Analytics Tab
    const analyticsSelectedCourseId = ref('');
    const courseAnalytics = ref({});

    // Load initial data
    onMounted(async () => {
      try {
        await loadUsers();
        await loadCourses();
      } catch (error) {
        console.error('Error loading initial data:', error);
        alert('Failed to load data. Check console for details.');
      }
    });

    // Computed properties with null safety
    const filteredUsers = computed(() => {
      if (!users.value || !Array.isArray(users.value)) return [];
      if (!userSearchTerm.value) return users.value;

      const term = userSearchTerm.value.toLowerCase();
      return users.value.filter(user => {
        if (!user) return false;
        const firstName = (user.firstName || user.FirstName || '').toLowerCase();
        const lastName = (user.lastName || user.LastName || '').toLowerCase();
        const email = (user.email || user.Email || '').toLowerCase();
        return firstName.includes(term) || lastName.includes(term) || email.includes(term);
      });
    });

    const filteredCourses = computed(() => {
      if (!courses.value || !Array.isArray(courses.value)) return [];
      if (!courseSearchTerm.value) return courses.value;

      const term = courseSearchTerm.value.toLowerCase();
      return courses.value.filter(course => {
        if (!course) return false;
        const title = (course.title || '').toLowerCase();
        const description = (course.description || '').toLowerCase();
        return title.includes(term) || description.includes(term);
      });
    });

    const filteredAssignUsers = computed(() => {
      if (!users.value || !Array.isArray(users.value)) return [];
      if (!assignUserSearchTerm.value) return users.value;

      const term = assignUserSearchTerm.value.toLowerCase();
      return users.value.filter(user => {
        if (!user) return false;
        const firstName = (user.firstName || user.FirstName || '').toLowerCase();
        const lastName = (user.lastName || user.LastName || '').toLowerCase();
        const email = (user.email || user.Email || '').toLowerCase();
        return firstName.includes(term) || lastName.includes(term) || email.includes(term);
      });
    });

    const filteredAssignCourses = computed(() => {
      if (!courses.value || !Array.isArray(courses.value)) return [];
      if (!assignCourseSearchTerm.value) return courses.value;

      const term = assignCourseSearchTerm.value.toLowerCase();
      return courses.value.filter(course => {
        if (!course) return false;
        const title = (course.title || '').toLowerCase();
        return title.includes(term);
      });
    });

    // Watch for changes
    watch(isFree, (newValue) => {
      if (newValue) {
        courseForm.value.price = 0;
      }
    });

    // User functions
    async function loadUsers() {
      loading.value = true;
      try {
        const userList = await UserService.getAllUsers();
        users.value = Array.isArray(userList) ? userList : [];
        console.log(`Loaded ${users.value.length} users`);
      } catch (error) {
        console.error('Error loading users:', error);
        users.value = []; // Ensure it's always an array
        alert('Failed to load users. Check console for details.');
      } finally {
        loading.value = false;
      }
    }

    async function reloadUsers() {
      await loadUsers();
    }

    async function searchUsers() {
      if (userSearchTerm.value.length >= 2) {
        try {
          const searchResults = await UserService.searchUsers(userSearchTerm.value);
          if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            users.value = searchResults;
          }
        } catch (error) {
          console.error('Error searching users:', error);
        }
      } else if (userSearchTerm.value.length === 0) {
        await loadUsers();
      }
    }

    async function searchAssignUsers() {
      if (assignUserSearchTerm.value.length >= 2) {
        try {
          const searchResults = await UserService.searchUsers(assignUserSearchTerm.value);
          if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            users.value = searchResults;
          }
        } catch (error) {
          console.error('Error searching users for assignment:', error);
        }
      }
    }

    function openAddBalanceModal(user) {
      selectedUser.value = user;
      balanceAmount.value = 0;
      balanceUpdateResult.value = null;
      showAddBalanceModal.value = true;
    }

    function closeAddBalanceModal() {
      showAddBalanceModal.value = false;
      setTimeout(() => {
        selectedUser.value = null;
        balanceAmount.value = 0;
        balanceUpdateResult.value = null;
      }, 300);
    }

    async function addBalance() {
      if (!selectedUser.value || balanceAmount.value <= 0) {
        balanceUpdateResult.value = {
          success: false,
          message: 'Please enter a valid amount greater than 0'
        };
        return;
      }

      addingBalance.value = true;
      try {
        const result = await UserService.updateUserBalance(selectedUser.value.id, parseFloat(balanceAmount.value));
        balanceUpdateResult.value = {
          success: true,
          message: `Successfully added ${formatBalance(balanceAmount.value)} to user's balance. New balance: ${formatBalance(result.newBalance)}`
        };

        // Update the user's balance in the local array
        const userIndex = users.value.findIndex(u => u.id === selectedUser.value.id);
        if (userIndex !== -1) {
          if (users.value[userIndex].UserBalance !== undefined) {
            users.value[userIndex].UserBalance = result.newBalance;
          } else {
            users.value[userIndex].userBalance = result.newBalance;
          }
        }

        // Auto-close after success
        setTimeout(() => {
          closeAddBalanceModal();
        }, 2000);
      } catch (error) {
        console.error('Error adding balance:', error);
        balanceUpdateResult.value = {
          success: false,
          message: `Failed to add balance: ${error.message}`
        };
      } finally {
        addingBalance.value = false;
      }
    }

    async function viewUserProgress(user) {
      selectedUser.value = user;
      showUserProgressModal.value = true;
      loadingUserProgress.value = true;
      userProgressData.value = []; // Initialize as empty array

      try {
        const progressData = await UserService.getUserProgressOverview(user.id);
        userProgressData.value = Array.isArray(progressData) ? progressData : [];
      } catch (error) {
        console.error('Error loading user progress:', error);
        userProgressData.value = []; // Ensure it's always an array
        alert('Failed to load user progress data');
      } finally {
        loadingUserProgress.value = false;
      }
    }

    function closeUserProgressModal() {
      showUserProgressModal.value = false;
      setTimeout(() => {
        selectedUser.value = null;
        userProgressData.value = [];
      }, 300);
    }

    // Course functions
    async function loadCourses() {
      loading.value = true;
      try {
        const courseList = await CourseService.getAllCourses();
        courses.value = Array.isArray(courseList) ? courseList : [];
        console.log(`Loaded ${courses.value.length} courses`);
      } catch (error) {
        console.error('Error loading courses:', error);
        courses.value = []; // Ensure it's always an array
        alert('Failed to load courses. Check console for details.');
      } finally {
        loading.value = false;
      }
    }

    function openAddCourseModal() {
      editingCourse.value = false;
      activeFormTab.value = 'basic';
      openLessonQuizEditors.value = {};

      courseForm.value = {
        id: '',
        title: '',
        description: '',
        categoryId: '1',
        price: 0,
        level: 'Beginner',
        imageUrl: '',
        isPremium: false,
        requirements: [''],
        whatYouWillLearn: [''],
        lessons: [],
        finalExam: {
          id: crypto.randomUUID(),
          title: '',
          description: 'Test your understanding of the entire course',
          questions: [],
          timeLimit: 30,
          passingScore: 70,
          attemptsAllowed: 3,
          requireAllLessonsCompleted: true,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        }
      };

      isFree.value = false;
      showCourseModal.value = true;
    }

    function editCourse(course) {
      if (!course) {
        console.error('Cannot edit undefined course');
        return;
      }

      editingCourse.value = true;
      activeFormTab.value = 'basic';
      openLessonQuizEditors.value = {};

      // Deep copy the course to avoid modifying the original
      const courseCopy = JSON.parse(JSON.stringify(course));

      // Prepare the course form with the course data
      courseForm.value = {
        id: courseCopy.id,
        title: courseCopy.title || '',
        description: courseCopy.description || '',
        categoryId: courseCopy.categoryId || '1',
        price: courseCopy.price || 0,
        level: courseCopy.level || 'Beginner',
        imageUrl: courseCopy.imageUrl || '',
        isPremium: courseCopy.isPremium || false,
        requirements: courseCopy.requirements || [''],
        whatYouWillLearn: courseCopy.whatYouWillLearn || [''],
        lessons: Array.isArray(courseCopy.lessons) ?
          courseCopy.lessons.map(lesson => {
            // Ensure each lesson has a quiz property
            if (!lesson.quiz) {
              lesson.quiz = {
                id: crypto.randomUUID(),
                title: `${lesson.title} Quiz`,
                description: 'Test your knowledge of this lesson',
                questions: [],
                timeLimit: 10,
                passingScore: 70,
                attemptsAllowed: 0,
                isEnabled: false,
                shuffleQuestions: false,
                shuffleOptions: false,
                showFeedback: true,
                allowReview: true
              };
            }

            // Add UI-specific properties
            return {
              ...lesson,
              collapsed: true,
              quiz: {
                ...lesson.quiz,
                questions: Array.isArray(lesson.quiz.questions) ?
                  lesson.quiz.questions.map(q => ({
                    ...q,
                    collapsed: true
                  })) : []
              }
            };
          }) : [],
        finalExam: courseCopy.finalExam || {
          id: crypto.randomUUID(),
          title: `${courseCopy.title || 'Final'} Exam`,
          description: 'Test your understanding of the entire course',
          questions: [],
          timeLimit: 30,
          passingScore: 70,
          attemptsAllowed: 3,
          requireAllLessonsCompleted: true,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        }
      };

      // Add collapsed property to exam questions
      if (courseForm.value.finalExam && Array.isArray(courseForm.value.finalExam.questions)) {
        courseForm.value.finalExam.questions = courseForm.value.finalExam.questions.map(q => ({
          ...q,
          collapsed: true
        }));
      }

      isFree.value = courseCopy.price === 0;
      showCourseModal.value = true;
    }

    function closeCourseModal() {
      showCourseModal.value = false;
      openLessonQuizEditors.value = {};
    }

    async function saveCourse() {
      // Validate required fields
      if (!courseForm.value.title || !courseForm.value.description || !courseForm.value.imageUrl) {
        alert('Please fill in all required fields');
        return;
      }

      // Ensure all lessons have titles
      const lessons = courseForm.value.lessons || [];
      for (const lesson of lessons) {
        if (!lesson.title) {
          alert('All lessons must have titles');
          return;
        }
      }

      savingCourse.value = true;
      try {
        // Prepare course data - remove UI-specific properties
        const courseData = { ...courseForm.value };

        // Process lessons to remove UI-only properties
        courseData.lessons = Array.isArray(courseData.lessons) ?
          courseData.lessons.map(lesson => {
            // Clean lesson
            const { collapsed, ...cleanLesson } = lesson;

            // Clean quiz questions
            if (cleanLesson.quiz && cleanLesson.quiz.questions) {
              cleanLesson.quiz.questions = Array.isArray(cleanLesson.quiz.questions) ?
                cleanLesson.quiz.questions.map(question => {
                  const { collapsed, ...cleanQuestion } = question;
                  return cleanQuestion;
                }) : [];
            }

            return cleanLesson;
          }) : [];

        // Clean exam questions
        if (courseData.finalExam && courseData.finalExam.questions) {
          courseData.finalExam.questions = Array.isArray(courseData.finalExam.questions) ?
            courseData.finalExam.questions.map(question => {
              const { collapsed, ...cleanQuestion } = question;
              return cleanQuestion;
            }) : [];
        }

        // Handle price based on free status
        if (isFree.value) {
          courseData.price = 0;
        }

        // Remove empty entries from arrays
        courseData.requirements = Array.isArray(courseData.requirements) ?
          courseData.requirements.filter(req => req && req.trim() !== '') : [];

        courseData.whatYouWillLearn = Array.isArray(courseData.whatYouWillLearn) ?
          courseData.whatYouWillLearn.filter(item => item && item.trim() !== '') : [];

        let result;
        if (editingCourse.value) {
          result = await CourseService.updateCourse(courseData.id, courseData);
        } else {
          result = await CourseService.createCourse(courseData);
        }

        alert(`Course ${editingCourse.value ? 'updated' : 'created'} successfully!`);

        // Reload courses and close modal
        await loadCourses();
        closeCourseModal();
      } catch (error) {
        console.error('Error saving course:', error);
        alert(`Failed to ${editingCourse.value ? 'update' : 'create'} course: ${error.message}`);
      } finally {
        savingCourse.value = false;
      }
    }

    async function deleteCourse(courseId) {
      if (!courseId) {
        console.error('Cannot delete course with undefined ID');
        return;
      }

      if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
        return;
      }

      try {
        await CourseService.deleteCourse(courseId);
        alert('Course deleted successfully');
        await loadCourses();
      } catch (error) {
        console.error('Error deleting course:', error);
        alert(`Failed to delete course: ${error.message}`);
      }
    }

    async function viewEnrollments(courseId) {
      if (!courseId) {
        console.error('Cannot view enrollments for undefined course ID');
        return;
      }

      const course = courses.value.find(c => c.id === courseId);
      if (course) {
        selectedCourse.value = course;
        showEnrollmentsModal.value = true;
        loadingEnrollments.value = true;
        courseEnrollments.value = []; // Initialize as empty array

        try {
          // Get response object and extract enrollments array
          const response = await CourseService.getCourseEnrollments(courseId);

          // Check if response has success property and enrollments array
          if (response && response.success === true && Array.isArray(response.enrollments)) {
            courseEnrollments.value = response.enrollments;
          } else if (Array.isArray(response)) {
            // Fallback for backward compatibility
            courseEnrollments.value = response;
          } else {
            console.error('Unexpected response format:', response);
            courseEnrollments.value = [];
          }
        } catch (error) {
          console.error('Error loading enrollments:', error);
          courseEnrollments.value = []; // Ensure it's always an array
          alert('Failed to load enrollment data');
        } finally {
          loadingEnrollments.value = false;
        }
      }
    }

    function closeEnrollmentsModal() {
      showEnrollmentsModal.value = false;
      setTimeout(() => {
        selectedCourse.value = null;
        courseEnrollments.value = [];
      }, 300);
    }

    // Quiz Analytics functions
    async function viewQuizAnalytics(course) {
      if (!course) {
        console.error('Cannot view analytics for undefined course');
        return;
      }

      selectedCourse.value = course;
      analyticsTab.value = 'exam';
      showQuizAnalyticsModal.value = true;
      loadingAnalytics.value = true;

      try {
        // Load exam analytics
        examAnalytics.value = await CourseService.getExamAnalytics(course.id);

        // Set up for lesson quizzes
        if (course.lessons && Array.isArray(course.lessons) && course.lessons.length > 0) {
          selectedLessonId.value = course.lessons[0].id;
          await loadLessonQuizAnalytics();
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
        examAnalytics.value = null;
        alert('Failed to load analytics data');
      } finally {
        loadingAnalytics.value = false;
      }
    }

    async function loadLessonQuizAnalytics() {
      if (!selectedLessonId.value || !selectedCourse.value) return;

      loadingLessonAnalytics.value = true;
      try {
        quizAnalytics.value = await CourseService.getQuizAnalytics(selectedCourse.value.id, selectedLessonId.value);
      } catch (error) {
        console.error('Error loading lesson quiz analytics:', error);
        quizAnalytics.value = null;
      } finally {
        loadingLessonAnalytics.value = false;
      }
    }

    function closeQuizAnalyticsModal() {
      showQuizAnalyticsModal.value = false;
      setTimeout(() => {
        selectedCourse.value = null;
        quizAnalytics.value = null;
        examAnalytics.value = null;
      }, 300);
    }

    // Course Analytics - FIX FOR ERROR
    async function loadCourseAnalytics() {
      if (!analyticsSelectedCourseId.value) return;

      loadingAnalytics.value = true;
      try {
        // Get exam analytics
        const examData = await CourseService.getExamAnalytics(analyticsSelectedCourseId.value);

        // Get enrollments with fixed response handling
        const enrollmentsResponse = await CourseService.getCourseEnrollments(analyticsSelectedCourseId.value);

        // Extract the enrollments array from the response
        let enrollmentsArray = [];

        // Handle different response formats
        if (enrollmentsResponse && enrollmentsResponse.success === true && Array.isArray(enrollmentsResponse.enrollments)) {
          // New format: { success: true, enrollments: [...] }
          enrollmentsArray = enrollmentsResponse.enrollments;
        } else if (Array.isArray(enrollmentsResponse)) {
          // Old format: direct array
          enrollmentsArray = enrollmentsResponse;
        } else {
          console.error('Unexpected enrollments response format:', enrollmentsResponse);
          enrollmentsArray = []; // Ensure it's an array
        }

        // Parse enrollment data for overall stats
        const totalEnrollments = enrollmentsArray.length;
        let completedCount = 0;
        let progressSum = 0;
        let quizAttempts = 0;
        let quizPasses = 0;
        let quizScoreSum = 0;

        // Process each enrollment safely
        enrollmentsArray.forEach(enrollment => {
          if (!enrollment) return;

          progressSum += enrollment.progress || 0;
          if (enrollment.isCompleted) completedCount++;

          // Aggregate quiz data from lesson progress
          if (enrollment.lessonProgress && Array.isArray(enrollment.lessonProgress)) {
            enrollment.lessonProgress.forEach(lesson => {
              if (!lesson) return;

              if (lesson.quizAttempts && Array.isArray(lesson.quizAttempts) && lesson.quizAttempts.length > 0) {
                quizAttempts += lesson.quizAttempts.length;

                // Find best score for this lesson
                const scores = lesson.quizAttempts.map(a => a && a.score ? a.score : 0);
                const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
                quizScoreSum += bestScore;

                // Check if any attempt passed
                if (lesson.quizCompleted) quizPasses++;
              }
            });
          }
        });

        // Calculate metrics
        const completionRate = totalEnrollments > 0 ? Math.round((completedCount / totalEnrollments) * 100) : 0;
        const avgProgress = totalEnrollments > 0 ? Math.round(progressSum / totalEnrollments) : 0;
        const avgQuizScore = quizAttempts > 0 ? Math.round(quizScoreSum / quizAttempts) : 0;
        const quizPassRate = quizAttempts > 0 ? Math.round((quizPasses / quizAttempts) * 100) : 0;

        // Get course for lesson data
        const course = courses.value.find(c => c.id === analyticsSelectedCourseId.value);

        // Combine all difficult questions
        let difficultQuestions = [];

        if (examData && examData.questionAnalytics && Array.isArray(examData.questionAnalytics)) {
          // Add exam questions
          difficultQuestions = examData.questionAnalytics.map(q => ({
            ...q,
            source: 'exam'
          }));
        }

        // Add quiz questions (would combine from all lessons in real implementation)
        if (course && course.lessons && Array.isArray(course.lessons)) {
          for (const lesson of course.lessons) {
            try {
              const quizData = await CourseService.getQuizAnalytics(analyticsSelectedCourseId.value, lesson.id);
              if (quizData && quizData.questionAnalytics && Array.isArray(quizData.questionAnalytics)) {
                difficultQuestions = [
                  ...difficultQuestions,
                  ...quizData.questionAnalytics.map(q => ({
                    ...q,
                    source: 'quiz',
                    lessonId: lesson.id,
                    lessonTitle: lesson.title || 'Unknown Lesson'
                  }))
                ];
              }
            } catch (error) {
              console.warn(`Could not load quiz data for lesson ${lesson.id}:`, error);
            }
          }
        }

        // Sort by correctRate (most difficult first)
        difficultQuestions.sort((a, b) => {
          const rateA = a.correctRate || 0;
          const rateB = b.correctRate || 0;
          return rateA - rateB;
        });

        // Take top 10 most difficult questions
        difficultQuestions = difficultQuestions.slice(0, 10);

        // Combine all data
        courseAnalytics.value = {
          totalEnrollments,
          completionRate,
          avgProgress,
          totalQuizAttempts: quizAttempts,
          avgQuizScore,
          quizPassRate,
          totalExamAttempts: examData ? examData.totalAttempts : 0,
          avgExamScore: examData ? examData.averageScore : 0,
          examPassRate: examData ? examData.passRate : 0,
          difficultQuestions
        };
      } catch (error) {
        console.error('Error loading course analytics:', error);
        courseAnalytics.value = {}; // Reset to empty object on error
        alert('Failed to load analytics data');
      } finally {
        loadingAnalytics.value = false;
      }
    }

    // Course form helpers
    function addRequirement() {
      if (!Array.isArray(courseForm.value.requirements)) {
        courseForm.value.requirements = [];
      }
      courseForm.value.requirements.push('');
    }

    function removeRequirement(index) {
      if (!Array.isArray(courseForm.value.requirements)) {
        courseForm.value.requirements = [];
        return;
      }

      courseForm.value.requirements.splice(index, 1);
      if (courseForm.value.requirements.length === 0) {
        courseForm.value.requirements.push('');
      }
    }

    function addWhatYouWillLearn() {
      if (!Array.isArray(courseForm.value.whatYouWillLearn)) {
        courseForm.value.whatYouWillLearn = [];
      }
      courseForm.value.whatYouWillLearn.push('');
    }

    function removeWhatYouWillLearn(index) {
      if (!Array.isArray(courseForm.value.whatYouWillLearn)) {
        courseForm.value.whatYouWillLearn = [];
        return;
      }

      courseForm.value.whatYouWillLearn.splice(index, 1);
      if (courseForm.value.whatYouWillLearn.length === 0) {
        courseForm.value.whatYouWillLearn.push('');
      }
    }

    function addLessonItem() {
      if (!Array.isArray(courseForm.value.lessons)) {
        courseForm.value.lessons = [];
      }

      courseForm.value.lessons.push({
        id: crypto.randomUUID(),
        title: '',
        description: '',
        videoUrl: '',
        duration: 0,
        isPreview: false,
        isLocked: false,
        resources: [],
        collapsed: false,
        quiz: {
          id: crypto.randomUUID(),
          title: 'Lesson Quiz',
          description: 'Test your knowledge of this lesson',
          questions: [],
          timeLimit: 10,
          passingScore: 70,
          attemptsAllowed: 0,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        }
      });
    }

    function removeLessonItem(index) {
      if (!Array.isArray(courseForm.value.lessons)) {
        courseForm.value.lessons = [];
        return;
      }

      courseForm.value.lessons.splice(index, 1);
      // Remove from open quiz editors if it exists
      delete openLessonQuizEditors.value[index];
    }

    function toggleLessonCollapse(index) {
      if (!Array.isArray(courseForm.value.lessons) || !courseForm.value.lessons[index]) {
        return;
      }

      courseForm.value.lessons[index].collapsed = !courseForm.value.lessons[index].collapsed;
    }

    function addResourceItem(lessonIndex) {
      if (!Array.isArray(courseForm.value.lessons) || !courseForm.value.lessons[lessonIndex]) {
        return;
      }

      if (!Array.isArray(courseForm.value.lessons[lessonIndex].resources)) {
        courseForm.value.lessons[lessonIndex].resources = [];
      }

      courseForm.value.lessons[lessonIndex].resources.push({
        id: crypto.randomUUID(),
        title: '',
        type: 'pdf',
        url: ''
      });
    }

    function removeResourceItem(lessonIndex, resourceIndex) {
      if (!Array.isArray(courseForm.value.lessons) ||
        !courseForm.value.lessons[lessonIndex] ||
        !Array.isArray(courseForm.value.lessons[lessonIndex].resources)) {
        return;
      }

      courseForm.value.lessons[lessonIndex].resources.splice(resourceIndex, 1);
    }

    // Quiz editor helpers
    function toggleLessonQuizEditor(lessonIndex) {
      if (openLessonQuizEditors.value[lessonIndex]) {
        delete openLessonQuizEditors.value[lessonIndex];
      } else {
        openLessonQuizEditors.value[lessonIndex] = true;
      }
    }

    function isLessonQuizEditorOpen(lessonIndex) {
      return !!openLessonQuizEditors.value[lessonIndex];
    }

    function addQuizQuestion(lessonIndex) {
      if (!Array.isArray(courseForm.value.lessons) || !courseForm.value.lessons[lessonIndex]) {
        return;
      }

      const newQuestion = {
        id: crypto.randomUUID(),
        text: '',
        type: 'multiple-choice',
        points: 1,
        options: [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' }
        ],
        correctAnswer: 0,
        explanation: '',
        collapsed: false
      };

      if (!courseForm.value.lessons[lessonIndex].quiz) {
        courseForm.value.lessons[lessonIndex].quiz = {
          id: crypto.randomUUID(),
          title: 'Lesson Quiz',
          description: 'Test your knowledge of this lesson',
          questions: [],
          timeLimit: 10,
          passingScore: 70,
          attemptsAllowed: 0,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        };
      }

      if (!Array.isArray(courseForm.value.lessons[lessonIndex].quiz.questions)) {
        courseForm.value.lessons[lessonIndex].quiz.questions = [];
      }

      courseForm.value.lessons[lessonIndex].quiz.questions.push(newQuestion);
    }

    function removeQuizQuestion(lessonIndex, questionIndex) {
      if (!Array.isArray(courseForm.value.lessons) ||
        !courseForm.value.lessons[lessonIndex] ||
        !courseForm.value.lessons[lessonIndex].quiz ||
        !Array.isArray(courseForm.value.lessons[lessonIndex].quiz.questions)) {
        return;
      }

      courseForm.value.lessons[lessonIndex].quiz.questions.splice(questionIndex, 1);
    }

    function toggleQuestionCollapse(lessonIndex, questionIndex) {
      if (!Array.isArray(courseForm.value.lessons) ||
        !courseForm.value.lessons[lessonIndex] ||
        !courseForm.value.lessons[lessonIndex].quiz ||
        !Array.isArray(courseForm.value.lessons[lessonIndex].quiz.questions) ||
        !courseForm.value.lessons[lessonIndex].quiz.questions[questionIndex]) {
        return;
      }

      const question = courseForm.value.lessons[lessonIndex].quiz.questions[questionIndex];
      question.collapsed = !question.collapsed;
    }

    function handleQuestionTypeChange(question) {
      if (!question) return;

      // Reset options based on question type
      if (question.type === 'multiple-choice') {
        question.options = question.options || [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' }
        ];
        question.correctAnswer = 0;
      } else if (question.type === 'true-false') {
        question.correctAnswer = true;
      } else if (question.type === 'multiple-answer') {
        question.options = question.options || [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' }
        ];
        question.correctAnswers = [];
      } else if (question.type === 'text') {
        question.correctAnswers = question.correctAnswers || [''];
        question.caseSensitive = false;
        textAnswersInput.value = question.correctAnswers.join('\n');
      } else if (question.type === 'matching') {
        question.pairs = question.pairs || [
          { id: crypto.randomUUID(), left: '', right: '' },
          { id: crypto.randomUUID(), left: '', right: '' }
        ];
      }
    }

    function addQuestionOption(question) {
      if (!question) return;

      if (!Array.isArray(question.options)) {
        question.options = [];
      }
      question.options.push({ id: crypto.randomUUID(), text: '' });
    }

    function removeQuestionOption(question, optionIndex) {
      if (!question || !Array.isArray(question.options)) return;

      question.options.splice(optionIndex, 1);

      // If we removed the correct answer, reset it
      if (question.type === 'multiple-choice' && question.correctAnswer === optionIndex) {
        question.correctAnswer = question.options.length > 0 ? 0 : null;
      } else if (question.type === 'multiple-answer' && Array.isArray(question.correctAnswers)) {
        // Remove this index from correctAnswers and adjust remaining indexes
        question.correctAnswers = question.correctAnswers
          .filter(index => index !== optionIndex)
          .map(index => index > optionIndex ? index - 1 : index);
      }
    }

    function updateTextAnswers(question) {
      if (!question) return;

      // Convert textarea input to array
      const answers = textAnswersInput.value
        .split('\n')
        .map(answer => answer.trim())
        .filter(answer => answer !== '');

      // If array is empty, add one blank item
      question.correctAnswers = answers.length > 0 ? answers : [''];
    }

    function addMatchingPair(question) {
      if (!question) return;

      if (!Array.isArray(question.pairs)) {
        question.pairs = [];
      }
      question.pairs.push({ id: crypto.randomUUID(), left: '', right: '' });
    }

    function removeMatchingPair(question, pairIndex) {
      if (!question || !Array.isArray(question.pairs)) return;

      question.pairs.splice(pairIndex, 1);
    }

    // Final Exam question helpers
    function addExamQuestion() {
      if (!courseForm.value.finalExam) {
        courseForm.value.finalExam = {
          id: crypto.randomUUID(),
          title: 'Final Exam',
          description: 'Test your understanding of the entire course',
          questions: [],
          timeLimit: 30,
          passingScore: 70,
          attemptsAllowed: 3,
          requireAllLessonsCompleted: true,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        };
      }

      const newQuestion = {
        id: crypto.randomUUID(),
        text: '',
        type: 'multiple-choice',
        points: 1,
        options: [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' }
        ],
        correctAnswer: 0,
        explanation: '',
        collapsed: false
      };

      if (!Array.isArray(courseForm.value.finalExam.questions)) {
        courseForm.value.finalExam.questions = [];
      }

      courseForm.value.finalExam.questions.push(newQuestion);
    }

    function removeExamQuestion(questionIndex) {
      if (!courseForm.value.finalExam || !Array.isArray(courseForm.value.finalExam.questions)) {
        return;
      }

      courseForm.value.finalExam.questions.splice(questionIndex, 1);
    }

    function toggleExamQuestionCollapse(questionIndex) {
      if (!courseForm.value.finalExam ||
        !Array.isArray(courseForm.value.finalExam.questions) ||
        !courseForm.value.finalExam.questions[questionIndex]) {
        return;
      }

      const question = courseForm.value.finalExam.questions[questionIndex];
      question.collapsed = !question.collapsed;
    }

    function handleExamQuestionTypeChange(question) {
      // Same logic as handleQuestionTypeChange but for exam questions
      handleQuestionTypeChange(question); // Reuse the same function
    }

    function addExamQuestionOption(question) {
      if (!question) return;

      if (!Array.isArray(question.options)) {
        question.options = [];
      }
      question.options.push({ id: crypto.randomUUID(), text: '' });
    }

    function removeExamQuestionOption(question, optionIndex) {
      if (!question || !Array.isArray(question.options)) return;

      question.options.splice(optionIndex, 1);

      // If we removed the correct answer, reset it
      if (question.type === 'multiple-choice' && question.correctAnswer === optionIndex) {
        question.correctAnswer = question.options.length > 0 ? 0 : null;
      } else if (question.type === 'multiple-answer' && Array.isArray(question.correctAnswers)) {
        // Remove this index from correctAnswers and adjust remaining indexes
        question.correctAnswers = question.correctAnswers
          .filter(index => index !== optionIndex)
          .map(index => index > optionIndex ? index - 1 : index);
      }
    }

    // Assignment functions
    function selectUserForAssignment(user) {
      selectedUser.value = user;
      assignmentResult.value = null;
    }

    function selectCourseForAssignment(course) {
      selectedCourse.value = course;
      assignmentResult.value = null;
    }

    async function assignCourse() {
      if (!selectedUser.value || !selectedCourse.value) {
        assignmentResult.value = {
          success: false,
          message: 'Please select both user and course'
        };
        return;
      }

      assigningCourse.value = true;
      try {
        // Display additional debug info
        console.log(`Attempting to enroll user ${selectedUser.value.id} in course ${selectedCourse.value.id}`);
        console.log('User object:', selectedUser.value);
        console.log('Course object:', selectedCourse.value);

        // Check if any values are null/undefined
        if (!selectedUser.value.id) {
          throw new Error('User ID is null or undefined');
        }

        if (!selectedCourse.value.id) {
          throw new Error('Course ID is null or undefined');
        }

        // Try to use the service, but be ready for failure
        try {
          const result = await CourseService.assignCourseToUser(selectedUser.value.id, selectedCourse.value.id);

          // Handle new response format with success property
          if (result && typeof result === 'object') {
            assignmentResult.value = {
              success: result.success !== false, // Default to true if not explicitly false
              message: result.message || 'Course assigned successfully'
            };

            // Show direct assignment option if there was a problem
            if (result.message && result.message.includes('already enrolled')) {
              showDirectAssignment.value = true;
            }
          } else {
            // Handle old format or unexpected response
            assignmentResult.value = {
              success: true,
              message: 'Course assigned successfully'
            };
          }
        } catch (serviceError) {
          console.error('Service error enrolling user:', serviceError);

          // Automatically show the direct assignment option
          showDirectAssignment.value = true;
          directCourseId.value = selectedCourse.value.id;
          directCourseTitle.value = selectedCourse.value.title;

          // Try the direct method immediately
          await directlyAssignCourse();
        }
      } catch (error) {
        console.error('Error in assignment process:', error);
        assignmentResult.value = {
          success: false,
          message: `Failed to assign course: ${error.message}`
        };
        showDirectAssignment.value = true;
      } finally {
        assigningCourse.value = false;
      }
    }

    async function directlyAssignCourse() {
      if (!selectedUser.value || !directCourseId.value || !directCourseTitle.value) {
        alert('Please enter all required information');
        return;
      }

      directAssigning.value = true;
      try {
        // Manual creation of enrollment document, bypassing the standard service
        // This is a workaround for when the standard service fails
        const { db, auth } = await import('../firebase/firebase');
        const {
          doc,
          setDoc,
          serverTimestamp,
          arrayUnion,
          collection,
          updateDoc,
          increment
        } = await import('firebase/firestore');

        const userId = selectedUser.value.id;
        const courseId = directCourseId.value;
        const courseTitle = directCourseTitle.value;

        // Create the enrollment ID using the userId and courseId
        const enrollmentId = `${userId}_${courseId}`;
        console.log(`Creating direct enrollment: ${enrollmentId}`);

        // Create a basic enrollment document with quiz tracking
        await setDoc(doc(db, 'Enrollments', enrollmentId), {
          userId: userId,
          courseId: courseId,
          courseTitle: courseTitle,
          enrolledAt: serverTimestamp(),
          progress: 0,
          lastAccessed: serverTimestamp(),
          isCompleted: false,
          status: 'active',
          completedLessons: 0,
          totalLessons: 0,
          lessonProgress: [],
          examAttempts: [],
          examCompleted: false,
          examBestScore: 0,
          examLastAttemptDate: null,
          certificateIssued: false,
          notes: []
        });

        // Update user's enrolled courses array if possible
        try {
          const userRef = doc(db, 'Users', userId);
          await updateDoc(userRef, {
            enrolledCourses: arrayUnion({
              courseId,
              courseTitle,
              enrolledAt: new Date().toISOString(),
              progress: 0
            }),
            lastActive: serverTimestamp()
          });
          console.log("Updated user's enrolled courses array");
        } catch (error) {
          console.warn("Could not update user's enrolled courses:", error);
        }

        // Update course enrollment count if possible
        try {
          const courseRef = doc(db, 'Courses', courseId);
          await updateDoc(courseRef, {
            enrollmentCount: increment(1),
            updatedAt: serverTimestamp()
          });
          console.log("Updated course enrollment count");
        } catch (error) {
          console.warn("Could not update course enrollment count:", error);
        }

        // Create legacy enrollment document
        try {
          const userEnrollmentRef = doc(db, `UserTasks/${userId}/EnrolledCourses`, courseId);
          await setDoc(userEnrollmentRef, {
            courseId,
            courseTitle,
            enrolledAt: serverTimestamp(),
            progress: 0,
            lastAccessedAt: serverTimestamp(),
            isCompleted: false,
            lessonProgress: []
          });
          console.log("Created legacy enrollment document");
        } catch (error) {
          console.warn("Could not create legacy enrollment:", error);
        }

        assignmentResult.value = {
          success: true,
          message: 'Course directly assigned successfully using manual method'
        };
      } catch (error) {
        console.error('Error in direct assignment:', error);
        assignmentResult.value = {
          success: false,
          message: `Direct assignment failed: ${error.message}`
        };
      } finally {
        directAssigning.value = false;
      }
    }

    // Utility functions
    function getCategoryName(categoryId) {
      return categories[categoryId] || 'Uncategorized';
    }

    function formatBalance(balance) {
      if (balance === undefined || balance === null) return '$0.00';
      return '$' + parseFloat(balance).toFixed(2);
    }

    function formatPrice(price) {
      if (price === 0) return 'Free';
      return '$' + parseFloat(price).toFixed(2);
    }

    function formatDate(timestamp) {
      if (!timestamp) return 'N/A';

      try {
        if (timestamp.seconds) {
          // Firestore timestamp
          return new Date(timestamp.seconds * 1000).toLocaleString();
        } else if (timestamp.toDate) {
          // Firestore serverTimestamp
          return timestamp.toDate().toLocaleString();
        } else if (typeof timestamp === 'string') {
          // ISO string
          return new Date(timestamp).toLocaleString();
        } else {
          // Unknown format
          return 'Invalid date';
        }
      } catch (e) {
        console.warn("Error formatting date:", e);
        return 'Invalid date';
      }
    }

    function formatQuestionType(type) {
      if (!type) return 'Unknown';

      const typeMap = {
        'multiple-choice': 'Multiple Choice',
        'true-false': 'True/False',
        'multiple-answer': 'Multiple Answer',
        'text': 'Text Input',
        'matching': 'Matching'
      };
      return typeMap[type] || type;
    }

    function getCorrectRateColor(rate) {
      if (rate < 30) return '#dc3545'; // Difficult - red
      if (rate < 70) return '#fd7e14'; // Moderate - orange
      return '#28a745'; // Easy - green
    }

    function truncateText(text, maxLength) {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    function countCompletedQuizzes(lessonProgress) {
      if (!lessonProgress || !Array.isArray(lessonProgress)) return 0;
      return lessonProgress.filter(lesson => lesson && lesson.quizCompleted).length;
    }

    function countTotalQuizzes(lessonProgress) {
      if (!lessonProgress || !Array.isArray(lessonProgress)) return 0;
      return lessonProgress.filter(lesson => lesson && lesson.quizId).length;
    }

    async function logout() {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (error) {
        console.error('Error signing out:', error);
        alert('Logout failed. Please try again.');
      }
    }

    return {
      // State
      activeTab,
      loading,
      users,
      courses,
      userSearchTerm,
      courseSearchTerm,
      assignUserSearchTerm,
      assignCourseSearchTerm,
      selectedUser,
      selectedCourse,
      assigningCourse,
      assignmentResult,
      showDirectAssignment,
      directCourseId,
      directCourseTitle,
      directAssigning,
      showAddBalanceModal,
      balanceAmount,
      addingBalance,
      balanceUpdateResult,
      showCourseModal,
      editingCourse,
      savingCourse,
      isFree,
      courseForm,
      activeFormTab,
      textAnswersInput,
      showUserProgressModal,
      loadingUserProgress,
      userProgressData,
      showEnrollmentsModal,
      loadingEnrollments,
      courseEnrollments,
      showQuizAnalyticsModal,
      loadingAnalytics,
      loadingLessonAnalytics,
      analyticsTab,
      selectedLessonId,
      quizAnalytics,
      examAnalytics,
      analyticsSelectedCourseId,
      courseAnalytics,

      // Computed
      filteredUsers,
      filteredCourses,
      filteredAssignUsers,
      filteredAssignCourses,

      // Functions
      loadUsers,
      reloadUsers,
      searchUsers,
      searchAssignUsers,
      openAddBalanceModal,
      closeAddBalanceModal,
      addBalance,
      viewUserProgress,
      closeUserProgressModal,
      loadCourses,
      openAddCourseModal,
      editCourse,
      closeCourseModal,
      saveCourse,
      deleteCourse,
      viewEnrollments,
      closeEnrollmentsModal,
      viewQuizAnalytics,
      loadLessonQuizAnalytics,
      closeQuizAnalyticsModal,
      loadCourseAnalytics,
      addRequirement,
      removeRequirement,
      addWhatYouWillLearn,
      removeWhatYouWillLearn,
      addLessonItem,
      removeLessonItem,
      toggleLessonCollapse,
      addResourceItem,
      removeResourceItem,
      toggleLessonQuizEditor,
      isLessonQuizEditorOpen,
      addQuizQuestion,
      removeQuizQuestion,
      toggleQuestionCollapse,
      handleQuestionTypeChange,
      addQuestionOption,
      removeQuestionOption,
      updateTextAnswers,
      addMatchingPair,
      removeMatchingPair,
      addExamQuestion,
      removeExamQuestion,
      toggleExamQuestionCollapse,
      handleExamQuestionTypeChange,
      addExamQuestionOption,
      removeExamQuestionOption,
      selectUserForAssignment,
      selectCourseForAssignment,
      assignCourse,
      directlyAssignCourse,
      getCategoryName,
      formatBalance,
      formatPrice,
      formatDate,
      formatQuestionType,
      getCorrectRateColor,
      truncateText,
      countCompletedQuizzes,
      countTotalQuizzes,
      logout
    };
  }
};
</script>

<style scoped>
/* Base Styles */
.dashboard-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #2c3e50;
  color: white;
}

.dashboard-content {
  flex: 1;
  padding: 1rem;
}

.dashboard-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
}

.sidebar {
  width: 220px;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
}

.main-content {
  flex: 1;
  background-color: white;
  border-radius: 0.25rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Navigation */
.nav-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  text-align: left;
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-item:hover {
  background-color: #e9ecef;
}

.nav-item.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

/* Section Headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  margin: 0;
  font-size: 1.5rem;
}

.subsection-title {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
}

/* Search */
.search-container {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}

/* Tables */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #dee2e6;
}

.text-left {
  text-align: left;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.table-row:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Buttons */
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Progress Bar */
.progress-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  height: 0.5rem;
  width: 100%;
  background-color: #e9ecef;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
}

.progress-text {
  min-width: 3rem;
  text-align: right;
  font-size: 0.875rem;
}

.progress-micro {
  height: 0.5rem;
  width: 5rem;
  background-color: #e9ecef;
  border-radius: 0.25rem;
  overflow: hidden;
  display: inline-block;
  margin-right: 0.5rem;
}

.progress-micro-fill {
  height: 100%;
  background-color: #007bff;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-lg {
  max-width: 800px;
}

.modal-xl {
  max-width: 1000px;
}

.modal-title {
  margin-top: 0;
  margin-bottom: 1rem;
}

.modal-subtitle {
  margin-top: -0.5rem;
  margin-bottom: 1rem;
  color: #6c757d;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

/* Forms */
.form-group {
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group-half {
  flex: 1;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

/* Checkbox and Radio */
.checkbox-container,
.radio-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-input,
.radio-input {
  margin: 0;
}

.checkbox-label,
.radio-label {
  margin: 0;
}

/* Assignment Grid */
.assign-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.assign-column {
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
}

.selection-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  background-color: white;
}

.selection-item {
  padding: 0.75rem;
  border-bottom: 1px solid #ced4da;
  cursor: pointer;
}

.selection-item:last-child {
  border-bottom: none;
}

.selection-item:hover {
  background-color: #f1f3f5;
}

.selection-item.selected {
  background-color: #e2f0ff;
}

.selected-items {
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.selected-item {
  margin-bottom: 0.5rem;
}

.selected-item:last-child {
  margin-bottom: 0;
}

.action-container {
  text-align: center;
}

.assignment-result {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.25rem;
}

.assignment-result.success {
  background-color: #d4edda;
  color: #155724;
}

.assignment-result.error {
  background-color: #f8d7da;
  color: #721c24;
}

/* Course Form */
.price-container {
  display: flex;
  flex-direction: column;
}

.list-editor {
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
}

.list-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.resource-item {
  background-color: white;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.resource-actions {
  display: flex;
  gap: 0.5rem;
}

.lessons-container {
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
}

.lesson-item {
  background-color: white;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
  overflow: hidden;
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #e9ecef;
  cursor: pointer;
}

.lesson-header-actions {
  display: flex;
  gap: 0.5rem;
}

.lesson-details {
  padding: 1rem;
}

/* Form Tabs */
.form-tabs {
  display: flex;
  margin-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.tab-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tab-btn.active {
  border-bottom-color: #007bff;
  color: #007bff;
}

.form-tab-content {
  margin-bottom: 1.5rem;
}

/* Quiz Editor */
.quiz-editor {
  background-color: #f0f8ff;
  border-radius: 0.25rem;
  padding: 1rem;
  margin-top: 1rem;
}

.quiz-editor-header {
  margin-bottom: 1rem;
}

.quiz-settings {
  margin-top: 1rem;
}

.quiz-questions-section {
  margin-top: 1.5rem;
  border-top: 1px solid #dee2e6;
  padding-top: 1rem;
}

.questions-list {
  margin-bottom: 1rem;
}

.question-item {
  background-color: white;
  border-radius: 0.25rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #e9ecef;
  cursor: pointer;
}

.question-type-badge {
  background-color: #6c757d;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin: 0 0.5rem;
}

.question-details {
  padding: 1rem;
}

.question-type-content {
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.option-item {
  margin-bottom: 0.5rem;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.radio-group {
  display: flex;
  gap: 2rem;
}

.matching-pair {
  margin-bottom: 0.5rem;
}

.pair-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pair-separator {
  font-size: 1.25rem;
  font-weight: bold;
}

.add-question-container {
  margin-top: 1rem;
  text-align: center;
}

/* Analytics */
.tabs {
  display: flex;
  margin-bottom: 1rem;
}

.analytics-section {
  margin-top: 1rem;
}

.analytics-content {
  margin-top: 1rem;
}

.analytics-overview {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  flex: 1;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  padding: 1rem;
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0.5rem 0 0;
}

.analytics-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-card {
  background-color: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

/* Utility Classes */
.mt-2 {
  margin-top: 0.5rem !important;
}

.mt-4 {
  margin-top: 1rem !important;
}

.mt-5 {
  margin-top: 1.5rem !important;
}

.mb-sm {
  margin-bottom: 0.5rem !important;
}

.ml-2 {
  margin-left: 0.5rem !important;
}

.mr-2 {
  margin-right: 0.5rem !important;
}

.mx-1 {
  margin-left: 0.25rem !important;
  margin-right: 0.25rem !important;
}

.text-success {
  color: #28a745 !important;
}

.text-muted {
  color: #6c757d !important;
}

.note {
  color: #6c757d;
  font-style: italic;
}

/* Loading States */
.loading-message,
.empty-message {
  padding: 2rem;
  text-align: center;
  color: #6c757d;
}

.quiz-progress-section {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #dee2e6;
}
</style>